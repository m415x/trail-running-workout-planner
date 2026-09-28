import { and, eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { format, isValid, parseISO, subDays } from 'date-fns'

import {
  athleteGroups,
  athleteProfiles,
  groupHistoryRecords,
  planningCohortMemberships,
  planningCohorts,
} from '@/db/schema'

interface GroupAssignmentInput {
  teamId: string
  athleteId: string
  newGroupId: string
  effectiveDate: string
  today: string
  reason: string | null
  changedByUserId: string | null
}

export interface AssignAthleteToGroupSynchronouslyInput<
  TSchema extends Record<string, unknown> = Record<string, never>,
> {
  db: BetterSQLite3Database<TSchema>
  createId: () => string
  now: () => string
  input: GroupAssignmentInput
}

export interface AthleteGroupAssignmentResult {
  changed: boolean
  previousGroupId: string | null
  newGroupId: string
  closedMembershipIds: string[]
}

function isIsoCalendarDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value))
}

function previousCalendarDate(value: string) {
  return format(subDays(parseISO(value), 1), 'yyyy-MM-dd')
}

/**
 * Changes an athlete's sporting group and reconciles previous-group cohort memberships
 * in one synchronous SQLite transaction.
 *
 * Open memberships that began before the effective date are closed on D-1. Any
 * previous-group membership that would remain applicable on/after D is rejected
 * rather than rewriting already recorded history.
 */
export function assignAthleteToGroupSynchronously<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  params: AssignAthleteToGroupSynchronouslyInput<TSchema>,
): AthleteGroupAssignmentResult {
  const { db, createId, now, input } = params

  if (!isIsoCalendarDate(input.effectiveDate) || !isIsoCalendarDate(input.today)) {
    throw new Error('La fecha efectiva del cambio de grupo no es válida')
  }

  if (input.effectiveDate > input.today) {
    throw new Error('No se puede programar un cambio de grupo para una fecha futura')
  }

  return db.transaction((tx) => {
    const athlete = tx
      .select({
        id: athleteProfiles.id,
        teamId: athleteProfiles.teamId,
        groupId: athleteProfiles.groupId,
      })
      .from(athleteProfiles)
      .where(and(
        eq(athleteProfiles.id, input.athleteId),
        eq(athleteProfiles.teamId, input.teamId),
        eq(athleteProfiles.isDeleted, false),
      ))
      .get()

    if (!athlete) {
      throw new Error('Atleta no encontrado')
    }

    const newGroup = tx
      .select({ id: athleteGroups.id })
      .from(athleteGroups)
      .where(and(
        eq(athleteGroups.id, input.newGroupId),
        eq(athleteGroups.teamId, input.teamId),
        eq(athleteGroups.isActive, true),
        eq(athleteGroups.isDeleted, false),
      ))
      .get()

    if (!newGroup) {
      throw new Error('Grupo no encontrado o inactivo')
    }

    if (athlete.groupId === newGroup.id) {
      return {
        changed: false,
        previousGroupId: athlete.groupId,
        newGroupId: newGroup.id,
        closedMembershipIds: [],
      }
    }

    const previousGroupId = athlete.groupId
    const nowIso = now()
    const closureDate = previousCalendarDate(input.effectiveDate)
    const closedMembershipIds: string[] = []

    if (previousGroupId !== null) {
      const previousGroupMemberships = tx
        .select({
          id: planningCohortMemberships.id,
          startDate: planningCohortMemberships.startDate,
          endDate: planningCohortMemberships.endDate,
        })
        .from(planningCohortMemberships)
        .innerJoin(
          planningCohorts,
          eq(planningCohorts.id, planningCohortMemberships.planningCohortId),
        )
        .where(and(
          eq(planningCohortMemberships.athleteProfileId, athlete.id),
          eq(planningCohortMemberships.isDeleted, false),
          eq(planningCohorts.teamId, input.teamId),
          eq(planningCohorts.groupId, previousGroupId),
          eq(planningCohorts.isDeleted, false),
        ))
        .all()

      for (const membership of previousGroupMemberships) {
        if (membership.startDate >= input.effectiveDate) {
          throw new Error('El cambio de grupo produciría una ambigüedad temporal en una cohorte existente')
        }

        if (membership.endDate !== null) {
          if (membership.endDate >= input.effectiveDate) {
            throw new Error('El cambio de grupo requeriría reescribir el historial de una cohorte existente')
          }
          continue
        }

        tx
          .update(planningCohortMemberships)
          .set({
            endDate: closureDate,
            endedByUserId: input.changedByUserId,
            endReason: input.reason,
            updatedAt: nowIso,
          })
          .where(eq(planningCohortMemberships.id, membership.id))
          .run()

        closedMembershipIds.push(membership.id)
      }
    }

    tx
      .update(athleteProfiles)
      .set({
        groupId: newGroup.id,
        updatedAt: nowIso,
      })
      .where(eq(athleteProfiles.id, athlete.id))
      .run()

    tx
      .insert(groupHistoryRecords)
      .values({
        id: createId(),
        athleteId: athlete.id,
        previousGroupId,
        newGroupId: newGroup.id,
        changedByUserId: input.changedByUserId,
        date: input.effectiveDate,
        reason: input.reason,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .run()

    return {
      changed: true,
      previousGroupId,
      newGroupId: newGroup.id,
      closedMembershipIds: closedMembershipIds.sort(),
    }
  })
}
