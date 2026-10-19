import { and, eq, inArray } from 'drizzle-orm'

import { db, sqliteConnection } from '@/db'
import {
  athleteGroups, groupSessionPrescriptions, groupTrainingPlans,
  macrocycles, mesocycles, microcycles, sessions,
} from '@/db/schema'
import { createExternalIdentityLookup } from '@/lib/auth/external-identity-lookup'
import { readEptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptAction, type RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'
import { createActiveTeamNextServerContext } from '@/lib/authorization/active-team-next-server'
import { createH4aNextServerAuthorizationBoundary } from '@/lib/authorization/h4a-next-server-authorization'
import { authorizeReviewSnapshotNextServer } from './authorized-review-snapshot-next-server'
import { authorizeReviewSnapshotAffectedGroupSet } from './authorized-review-snapshot-affected-group-set'
import { getActiveReviewSnapshotSqlite } from './review-snapshot-sqlite-repository'

interface Request {
  readonly groupTrainingPlanId: string
  readonly snapshotId: string
}

/**
 * Preauthorizes ALL groups touched by reconciliation, not only the Plan group.
 * Snapshot ID is a locator; proposal/owner come from SQL, and both the H2/H3
 * actor evidence and per-group H4A rights are resolved afresh on the server.
 * The writer re-reads its affected-group set inside the CAS IMMEDIATE
 * transaction and rejects any group not included here (TOCTOU fail closed).
 */
export async function authorizeReviewSnapshotAffectedGroupsNextServer(
  request: Request,
): Promise<ReadonlySet<string> | null> {
  const decision = await authorizeReviewSnapshotNextServer(request)
  if (decision.kind !== 'authorized') return null
  const scope = decision.scope

  const snapshot = getActiveReviewSnapshotSqlite(sqliteConnection, {
    id: request.snapshotId,
    userId: scope.userId,
    teamId: scope.teamId,
    groupTrainingPlanId: scope.groupTrainingPlanId,
  }, new Date().toISOString())
  if (!snapshot || snapshot.userId !== scope.userId ||
    snapshot.teamId !== scope.teamId ||
    snapshot.groupTrainingPlanId !== scope.groupTrainingPlanId ||
    snapshot.groupId !== scope.groupId ||
    snapshot.planningCohortId !== scope.planningCohortId) return null

  const proposal = snapshot.proposal
  if (!proposal || typeof proposal !== 'object' ||
    !('events' in proposal) || !Array.isArray(proposal.events)) return null

  const plan = db.select({ groupId: groupTrainingPlans.groupId })
    .from(groupTrainingPlans)
    .where(and(
      eq(groupTrainingPlans.id, scope.groupTrainingPlanId),
      eq(groupTrainingPlans.isDeleted, false),
    )).get()
  if (!plan || plan.groupId !== scope.groupId) return null

  const planMicrocycles = db.select({ id: microcycles.id })
    .from(microcycles)
    .innerJoin(mesocycles, eq(microcycles.mesocycleId, mesocycles.id))
    .innerJoin(macrocycles, eq(mesocycles.macrocycleId, macrocycles.id))
    .where(and(
      eq(macrocycles.groupTrainingPlanId, scope.groupTrainingPlanId),
      eq(microcycles.isDeleted, false),
    )).all()
  const microcycleIds = planMicrocycles.map(({ id }) => id)
  const currentPlanPrescriptions = microcycleIds.length === 0 ? [] : db.select({
    sessionId: groupSessionPrescriptions.sessionId,
  }).from(groupSessionPrescriptions)
    .where(and(
      inArray(groupSessionPrescriptions.microcycleId, microcycleIds),
      eq(groupSessionPrescriptions.isDeleted, false),
    )).all()

  const proposedEventKeys: string[] = []
  const resultingGroupIds: string[] = []
  for (const event of proposal.events) {
    if (!event || typeof event !== 'object' ||
      !('sharedEventKey' in event) || typeof event.sharedEventKey !== 'string' ||
      !event.sharedEventKey.trim() || !('prescriptions' in event) ||
      !Array.isArray(event.prescriptions)) return null
    proposedEventKeys.push(event.sharedEventKey)
    for (const item of event.prescriptions) {
      if (!item || typeof item !== 'object' || !('prescription' in item) ||
        !item.prescription || typeof item.prescription !== 'object' ||
        !('groupId' in item.prescription) ||
        typeof item.prescription.groupId !== 'string' ||
        !item.prescription.groupId.trim()) return null
      resultingGroupIds.push(item.prescription.groupId)
    }
  }

  const planSessionIds = [...new Set(currentPlanPrescriptions.map(p => p.sessionId))]
  const byPlan = planSessionIds.length === 0 ? [] : db.select()
    .from(sessions).where(inArray(sessions.id, planSessionIds)).all()
  const byEventKey = proposedEventKeys.length === 0 ? [] : db.select()
    .from(sessions).where(inArray(sessions.sharedEventKey, proposedEventKeys)).all()
  const persistedEvents = [...new Map(
    [...byPlan, ...byEventKey].map(event => [event.id, event]),
  ).values()]
  if (persistedEvents.some(event => event.teamId !== scope.teamId)) return null

  const affectedSessionIds = persistedEvents.map(event => event.id)
  const current = affectedSessionIds.length === 0 ? [] : db.select({
    groupId: groupSessionPrescriptions.groupId,
  }).from(groupSessionPrescriptions)
    .where(and(
      inArray(groupSessionPrescriptions.sessionId, affectedSessionIds),
      eq(groupSessionPrescriptions.isDeleted, false),
    )).all()
  const allGroupIds = new Set([
    plan.groupId,
    ...current.map(row => row.groupId),
    ...resultingGroupIds,
  ])

  const authorization = createH4aNextServerAuthorizationBoundary()
  let authenticatedAccess: RequireAuthenticatedActionResult | null = null
  return authorizeReviewSnapshotAffectedGroupSet({
    ownerUserId: snapshot.userId,
    ownerTeamId: snapshot.teamId,
    groupIds: [...allGroupIds],
    resolveActor: async () => {
      const supabase = await createSupabaseServerClient()
      const access = await requireAuthenticatedEptAction({
        readAccess: () => readEptSessionAccessState(
          supabase.auth, createExternalIdentityLookup(),
        ),
      })
      if (access.status !== 'authenticated') return null
      authenticatedAccess = access
      const activeTeam = await createActiveTeamNextServerContext().resolve(access.userId)
      if (activeTeam.status !== 'resolved') return null
      return { userId: access.userId, teamId: activeTeam.teamId }
    },
    readGroup: async groupId => {
      const group = db.select({ id: athleteGroups.id, teamId: athleteGroups.teamId })
        .from(athleteGroups)
        .where(and(eq(athleteGroups.id, groupId), eq(athleteGroups.isDeleted, false)))
        .get()
      return group ?? null
    },
    authorizeGroup: async (actor, groupId) => {
      const access = authenticatedAccess
      if (!access || access.status !== 'authenticated' ||
        access.userId !== actor.userId || actor.teamId !== snapshot.teamId) return false
      const group = db.select({ id: athleteGroups.id, teamId: athleteGroups.teamId })
        .from(athleteGroups)
        .where(and(eq(athleteGroups.id, groupId), eq(athleteGroups.isDeleted, false)))
        .get()
      if (!group || group.teamId !== snapshot.teamId) return false
      const allowed = await authorization.authorize(access, {
        capability: 'planning.manage',
        resource: { teamId: group.teamId, sportingGroupId: group.id },
        at: new Date().toISOString(),
      })
      return allowed.allowed && 'teamId' in allowed && allowed.teamId === snapshot.teamId
    },
  })
}
