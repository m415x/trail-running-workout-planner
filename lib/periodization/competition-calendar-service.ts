import { randomUUID } from 'node:crypto'

import { db } from '@/db'
import { groupTrainingPlans, macrocycles } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import {
  createCompetitionRecord,
  getCompetitionById,
  listCompetitionsByPlan,
  rescheduleCompetitionRecord,
  updateCompetitionRecord,
  updateCompetitionStatusRecord,
} from '@/lib/periodization/competition-repository'
import {
  validateCompetitionCalendarMutation,
  type CompetitionCalendarPolicyErrorCode,
} from '@/lib/periodization/competition-calendar-policy'
import { validateCompetitionStatusTransition } from '@/lib/periodization/competition-lifecycle'
import type {
  CompetitionEntry,
  CompetitionEntryDraft,
  CompetitionStatus,
} from '@/types/training/competition-entry.types'
import type { GroupTrainingPlanKind } from '@/types/training/periodization.types'

type CompetitionDatabase = typeof db

export type CompetitionCalendarServiceErrorCode =
  | CompetitionCalendarPolicyErrorCode
  | 'competition_calendar_plan_not_found'
  | 'competition_calendar_entry_not_found'
  | 'competition_calendar_entry_plan_mismatch'
  | 'competition_lifecycle_transition_not_allowed'

export type CompetitionCalendarServiceResult<T> =
  | {
      readonly ok: true
      readonly value: T
      readonly sameDateCompetitionIds: readonly string[]
    }
  | {
      readonly ok: false
      readonly errors: readonly CompetitionCalendarServiceErrorCode[]
      readonly sameDateCompetitionIds: readonly string[]
    }

interface CompetitionMutationContext {
  readonly planId: string
  readonly planKind: GroupTrainingPlanKind
  readonly coversEntirePlanAudience: boolean
  readonly database?: CompetitionDatabase
}

export interface CreateCompetitionInput extends CompetitionMutationContext {
  readonly draft: CompetitionEntryDraft
  readonly id?: string
  readonly now?: string
}

export interface UpdateCompetitionInput extends CompetitionMutationContext {
  readonly competitionId: string
  readonly draft: CompetitionEntryDraft
  readonly now?: string
}

export interface RescheduleCompetitionInput extends CompetitionMutationContext {
  readonly competitionId: string
  readonly date: string
  readonly now?: string
}

export interface ChangeCompetitionStatusInput extends CompetitionMutationContext {
  readonly competitionId: string
  readonly status: CompetitionStatus
  readonly now?: string
}

/** Reads the persisted calendar for one plan. */
export function getCompetitionCalendar(
  groupTrainingPlanId: string,
  database: CompetitionDatabase = db,
): CompetitionEntry[] {
  return listCompetitionsByPlan(groupTrainingPlanId, database)
}

function loadPlanContext(planId: string, database: CompetitionDatabase) {
  const plan = database.query.groupTrainingPlans.findFirst({
    where: and(
      eq(groupTrainingPlans.id, planId),
      eq(groupTrainingPlans.isDeleted, false),
    ),
  }).sync()

  if (!plan) return null

  const windows = database.query.macrocycles.findMany({
    where: and(
      eq(macrocycles.groupTrainingPlanId, planId),
      eq(macrocycles.isDeleted, false),
    ),
  }).sync().map((macrocycle) => ({
    id: macrocycle.id,
    startDate: macrocycle.startDate,
    endDate: macrocycle.endDate,
  }))

  return { plan, windows }
}

function validateMutation(
  context: CompetitionMutationContext,
  draft: CompetitionEntryDraft,
  currentCompetitionId?: string,
): CompetitionCalendarServiceResult<null> {
  const database = context.database ?? db
  const planContext = loadPlanContext(context.planId, database)

  if (!planContext) {
    return {
      ok: false,
      errors: ['competition_calendar_plan_not_found'],
      sameDateCompetitionIds: [],
    }
  }

  if (draft.groupTrainingPlanId !== context.planId) {
    return {
      ok: false,
      errors: ['competition_calendar_entry_plan_mismatch'],
      sameDateCompetitionIds: [],
    }
  }

  const result = validateCompetitionCalendarMutation({
    draft,
    planKind: context.planKind,
    coversEntirePlanAudience: context.coversEntirePlanAudience,
    macrocycles: planContext.windows,
    existingCompetitions: listCompetitionsByPlan(context.planId, database),
    currentCompetitionId,
  })

  return result.valid
    ? { ok: true, value: null, sameDateCompetitionIds: result.sameDateCompetitionIds }
    : { ok: false, errors: result.errors, sameDateCompetitionIds: result.sameDateCompetitionIds }
}

/** Validates and creates one competition without coupling the domain to a UI. */
export function createCompetition(input: CreateCompetitionInput): CompetitionCalendarServiceResult<CompetitionEntry> {
  const database = input.database ?? db
  const validation = validateMutation(input, input.draft)
  if (!validation.ok) return validation

  const value = createCompetitionRecord({
    id: input.id ?? randomUUID(),
    draft: input.draft,
    createdAt: input.now ?? new Date().toISOString(),
  }, database)

  return { ok: true, value, sameDateCompetitionIds: validation.sameDateCompetitionIds }
}

/** Validates and replaces the mutable fields of an existing competition. */
export function updateCompetition(input: UpdateCompetitionInput): CompetitionCalendarServiceResult<CompetitionEntry> {
  const database = input.database ?? db
  const existing = getCompetitionById(input.competitionId, database)

  if (!existing) {
    return { ok: false, errors: ['competition_calendar_entry_not_found'], sameDateCompetitionIds: [] }
  }

  if (existing.groupTrainingPlanId !== input.planId) {
    return { ok: false, errors: ['competition_calendar_entry_plan_mismatch'], sameDateCompetitionIds: [] }
  }

  const validation = validateMutation(input, input.draft, input.competitionId)
  if (!validation.ok) return validation

  const value = updateCompetitionRecord({
    id: input.competitionId,
    draft: input.draft,
    updatedAt: input.now ?? new Date().toISOString(),
  }, database)

  if (!value) {
    return { ok: false, errors: ['competition_calendar_entry_not_found'], sameDateCompetitionIds: [] }
  }

  return { ok: true, value, sameDateCompetitionIds: validation.sameDateCompetitionIds }
}

/** Reprograms a competition while preserving its lifecycle state. */
export function rescheduleCompetition(input: RescheduleCompetitionInput): CompetitionCalendarServiceResult<CompetitionEntry> {
  const database = input.database ?? db
  const existing = getCompetitionById(input.competitionId, database)

  if (!existing) {
    return { ok: false, errors: ['competition_calendar_entry_not_found'], sameDateCompetitionIds: [] }
  }

  if (existing.groupTrainingPlanId !== input.planId) {
    return { ok: false, errors: ['competition_calendar_entry_plan_mismatch'], sameDateCompetitionIds: [] }
  }

  const draft: CompetitionEntryDraft = { ...existing, date: input.date }
  const validation = validateMutation(input, draft, input.competitionId)
  if (!validation.ok) return validation

  const value = rescheduleCompetitionRecord(
    input.competitionId,
    input.date,
    input.now ?? new Date().toISOString(),
    database,
  )

  if (!value) {
    return { ok: false, errors: ['competition_calendar_entry_not_found'], sameDateCompetitionIds: [] }
  }

  return { ok: true, value, sameDateCompetitionIds: validation.sameDateCompetitionIds }
}

/** Applies an explicit lifecycle transition; cancellation never deletes history. */
export function changeCompetitionStatus(
  input: ChangeCompetitionStatusInput,
): CompetitionCalendarServiceResult<CompetitionEntry> {
  const database = input.database ?? db
  const existing = getCompetitionById(input.competitionId, database)

  if (!existing) {
    return { ok: false, errors: ['competition_calendar_entry_not_found'], sameDateCompetitionIds: [] }
  }

  if (existing.groupTrainingPlanId !== input.planId) {
    return { ok: false, errors: ['competition_calendar_entry_plan_mismatch'], sameDateCompetitionIds: [] }
  }

  const transition = validateCompetitionStatusTransition(existing.status, input.status)
  if (!transition.valid) {
    return {
      ok: false,
      errors: [transition.error],
      sameDateCompetitionIds: [],
    }
  }

  const draft: CompetitionEntryDraft = { ...existing, status: input.status }
  const validation = validateMutation(input, draft, input.competitionId)
  if (!validation.ok) return validation

  const value = updateCompetitionStatusRecord(
    input.competitionId,
    input.status,
    input.now ?? new Date().toISOString(),
    database,
  )

  if (!value) {
    return { ok: false, errors: ['competition_calendar_entry_not_found'], sameDateCompetitionIds: [] }
  }

  return { ok: true, value, sameDateCompetitionIds: validation.sameDateCompetitionIds }
}
