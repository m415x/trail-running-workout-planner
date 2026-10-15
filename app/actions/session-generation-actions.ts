'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import { createExternalIdentityLookup } from '@/lib/auth/external-identity-lookup'
import { readEptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptAction } from '@/lib/auth/require-authenticated-action'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'
import { createActiveTeamNextServerContext } from '@/lib/authorization/active-team-next-server'
import { createH4aNextServerAuthorizationBoundary } from '@/lib/authorization/h4a-next-server-authorization'
import {
  groupSessionPrescriptions,
  groupTrainingPlans,
  athleteGroups,
  macrocycles,
  mesocycles,
  microcycles,
  sessions,
} from '@/db/schema'
import { reconcileAndPersistGeneratedSessionsSqlite } from '@/lib/session-generation/review-snapshot-reconciliation-writer'
import { parseGenerationExplanationSnapshots } from '@/lib/session-generation/generation-explanation-persistence'
import type { GenerationExplanation } from '@/lib/session-generation/generation-explanation'
import { isWorkoutType } from '@/types/training/workout.types'
import type { SharedSessionGenerationResult } from '@/types/training/session-generation.types'

async function authorizePlanningGeneration(planId: string) {
  const supabase = await createSupabaseServerClient()
  const lookup = createExternalIdentityLookup()
  const access = await requireAuthenticatedEptAction({
    readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
  })
  if (access.status !== 'authenticated') return null
  const activeTeam = await createActiveTeamNextServerContext().resolve(access.userId)
  if (activeTeam.status !== 'resolved') return null

  const plan = await db.select({
    id: groupTrainingPlans.id,
    groupId: groupTrainingPlans.groupId,
    teamId: athleteGroups.teamId,
  }).from(groupTrainingPlans)
    .innerJoin(athleteGroups, eq(groupTrainingPlans.groupId, athleteGroups.id))
    .where(and(
      eq(groupTrainingPlans.id, planId),
      eq(groupTrainingPlans.isDeleted, false),
      eq(athleteGroups.isDeleted, false),
      eq(athleteGroups.teamId, activeTeam.teamId),
    )).get()
  if (!plan) return null

  const authorization = createH4aNextServerAuthorizationBoundary()
  const authorizeGroup = async (groupId: string) => {
    const group = await db.query.athleteGroups.findFirst({
      where: and(eq(athleteGroups.id, groupId), eq(athleteGroups.isDeleted, false)),
    })
    if (!group || group.teamId !== activeTeam.teamId) return false
    const decision = await authorization.authorize(access, {
      capability: 'planning.manage',
      resource: { teamId: group.teamId, sportingGroupId: group.id },
      at: new Date().toISOString(),
    })
    return decision.allowed
  }
  if (!await authorizeGroup(plan.groupId)) return null
  return { userId: access.userId, teamId: activeTeam.teamId, authorizeGroup }
}

export interface PersistGeneratedSessionsState {
  error?: string
  success?: string
}

/** Persists the reviewed proposal idempotently without overwriting protected records. */
export async function persistGeneratedSessions(
  _previousState: PersistGeneratedSessionsState,
  formData: FormData,
): Promise<PersistGeneratedSessionsState> {
  const planId = formData.get('planId')?.toString()
  const locale = formData.get('locale')?.toString() || 'es'
  const rawProposal = formData.get('proposal')?.toString()
  const rawGenerationExplanations = formData.get('generationExplanations')?.toString()
  if (!planId || !rawProposal) return { error: 'No se pudo identificar la propuesta.' }

  try {
    const generationAccess = await authorizePlanningGeneration(planId)
    if (!generationAccess) return { error: 'No autorizado' }
    const proposal = parseProposal(rawProposal)
    const generationExplanations = rawGenerationExplanations
      ? parseGenerationExplanationSnapshots(rawGenerationExplanations)
      : new Map<string, GenerationExplanation>()
    const plan = db.select({
      id: groupTrainingPlans.id,
      groupId: groupTrainingPlans.groupId,
      planningCohortId: groupTrainingPlans.planningCohortId,
    })
      .from(groupTrainingPlans)
      .innerJoin(athleteGroups, eq(groupTrainingPlans.groupId, athleteGroups.id))
      .where(and(
        eq(groupTrainingPlans.id, planId),
        eq(athleteGroups.teamId, generationAccess.teamId),
        eq(groupTrainingPlans.isDeleted, false),
      ))
      .get()
    if (!plan) return { error: 'La planificación no existe.' }

    const planMicrocycles = db.select({ id: microcycles.id })
      .from(microcycles)
      .innerJoin(mesocycles, eq(microcycles.mesocycleId, mesocycles.id))
      .innerJoin(macrocycles, eq(mesocycles.macrocycleId, macrocycles.id))
      .where(and(
        eq(macrocycles.groupTrainingPlanId, planId),
        eq(microcycles.isDeleted, false),
      ))
      .all()
    const microcycleIds = new Set(planMicrocycles.map(({ id }) => id))
    validateProposalScope(proposal, plan.groupId, microcycleIds)

    const persistedPrescriptions = planMicrocycles.length === 0 ? [] : db.select()
      .from(groupSessionPrescriptions)
      .where(and(
        inArray(groupSessionPrescriptions.microcycleId, [...microcycleIds]),
        eq(groupSessionPrescriptions.isDeleted, false),
      ))
      .all()
    const proposedEventKeys = proposal.events.map(({ sharedEventKey }) => sharedEventKey)
    const relatedSessionIds = [...new Set(persistedPrescriptions.map(({ sessionId }) => sessionId))]
    const persistedEventsById = relatedSessionIds.length === 0 ? [] : db.select()
      .from(sessions)
      .where(inArray(sessions.id, relatedSessionIds))
      .all()
    const persistedEventsByKey = proposedEventKeys.length === 0 ? [] : db.select()
      .from(sessions)
      .where(inArray(sessions.sharedEventKey, proposedEventKeys))
      .all()
    const persistedEvents = [...new Map(
      [...persistedEventsById, ...persistedEventsByKey].map((event) => [event.id, event]),
    ).values()]

    // A shared session can belong to other plans. Check every current group,
    // including prescriptions outside the source plan, before reconciliation.
    const affectedSessionIds = [...new Set(persistedEvents.map((event) => event.id))]
    const allCurrentPrescriptions = affectedSessionIds.length === 0 ? [] : await db.select({
      groupId: groupSessionPrescriptions.groupId,
    }).from(groupSessionPrescriptions)
      .where(and(
        inArray(groupSessionPrescriptions.sessionId, affectedSessionIds),
        eq(groupSessionPrescriptions.isDeleted, false),
      )).all()
    const priorGroupIds = allCurrentPrescriptions.map(({ groupId }) => groupId)
    const resultingGroupIds = proposal.events.flatMap((event) =>
      event.prescriptions.map((prescription) => prescription.prescription.groupId))
    const allGroups = [...new Set([plan.groupId, ...priorGroupIds, ...resultingGroupIds])]
    const decisions = await Promise.all(allGroups.map((groupId) => generationAccess.authorizeGroup(groupId)))
    if (!decisions.every(Boolean)) return { error: 'No autorizado' }
    // Also reject collisions with events owned by another Team.
    if (persistedEvents.some((event) => event.teamId !== generationAccess.teamId)) {
      return { error: 'No autorizado' }
    }

    const protectedCount = reconcileAndPersistGeneratedSessionsSqlite({
      database: db,
      planId, teamId: generationAccess.teamId, userId: generationAccess.userId,
      proposal, generationExplanations,
      authorizedGroupIds: new Set(allGroups),
      now: new Date().toISOString(),
    })

    const basePath = locale === 'es' ? '/dashboard' : `/${locale}/dashboard`
    revalidatePath(`${basePath}/planning/${planId}`)
    revalidatePath(`${basePath}/sessions`)
    revalidatePath(locale === 'es' ? '/plan' : `/${locale}/plan`)

    return {
      success: protectedCount > 0
        ? `Propuesta guardada. Se preservaron ${protectedCount} modificaciones manuales.`
        : 'Propuesta de sesiones guardada correctamente.',
    }
  } catch (error) {
    console.error('Error persisting generated sessions:', error)
    return { error: error instanceof Error ? error.message : 'No se pudo guardar la propuesta.' }
  }
}

function parseProposal(value: string): SharedSessionGenerationResult {
  if (value.length > 1_000_000) throw new Error('La propuesta de sesiones es demasiado grande.')
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== 'object' || !('events' in parsed) || !Array.isArray(parsed.events)) {
    throw new Error('La propuesta de sesiones no es válida.')
  }
  return parsed as SharedSessionGenerationResult
}

function validateProposalScope(
  proposal: SharedSessionGenerationResult,
  groupId: string,
  microcycleIds: Set<string>,
) {
  for (const event of proposal.events) {
    if (
      !event.sharedEventKey?.trim()
      || !/^\d{4}-\d{2}-\d{2}$/.test(event.session?.date ?? '')
      || !event.session?.title?.trim()
      || !isWorkoutType(event.session?.type)
      || !Array.isArray(event.prescriptions)
    ) {
      throw new Error('La propuesta contiene un evento incompleto.')
    }
    for (const item of event.prescriptions ?? []) {
      if (item.prescription.groupId !== groupId || !microcycleIds.has(item.prescription.microcycleId)) {
        throw new Error('La propuesta contiene una prescripción fuera de la planificación.')
      }
    }
  }
}
