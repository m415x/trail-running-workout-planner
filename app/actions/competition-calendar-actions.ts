'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import { groupTrainingPlans } from '@/db/schema'
import {
  changeCompetitionStatus,
  createCompetition,
  getCompetitionCalendar,
  rescheduleCompetition,
  updateCompetition,
  type CompetitionCalendarServiceErrorCode,
} from '@/lib/periodization/competition-calendar-service'
import type {
  CompetitionEntry,
  CompetitionEntryDraft,
  CompetitionStatus,
} from '@/types/training/competition-entry.types'
import type { GroupTrainingPlanKind } from '@/types/training/periodization.types'

const CURRENT_TEAM_ID = 'team_1'
const locales = ['es', 'en'] as const

type SupportedLocale = (typeof locales)[number]
type EditableCompetitionDraft = Omit<CompetitionEntryDraft, 'groupTrainingPlanId' | 'status'>

export type CompetitionCalendarActionErrorCode =
  | CompetitionCalendarServiceErrorCode
  | 'competition_calendar_plan_forbidden'

export type CompetitionCalendarActionResult<T> =
  | {
      readonly ok: true
      readonly value: T
      readonly sameDateCompetitionIds: readonly string[]
    }
  | {
      readonly ok: false
      readonly errors: readonly CompetitionCalendarActionErrorCode[]
      readonly sameDateCompetitionIds: readonly string[]
    }

export interface CompetitionCalendarActionContext {
  readonly planId: string
  readonly locale?: SupportedLocale
}

export interface CreateCompetitionActionInput extends CompetitionCalendarActionContext {
  readonly draft: Omit<CompetitionEntryDraft, 'groupTrainingPlanId'>
}

export interface UpdateCompetitionActionInput extends CompetitionCalendarActionContext {
  readonly competitionId: string
  readonly draft: EditableCompetitionDraft
}

export interface RescheduleCompetitionActionInput extends CompetitionCalendarActionContext {
  readonly competitionId: string
  readonly date: string
}

export interface ChangeCompetitionStatusActionInput extends CompetitionCalendarActionContext {
  readonly competitionId: string
  readonly status: CompetitionStatus
}

function planningPath(locale: SupportedLocale, planId: string) {
  const base = locale === 'es' ? '/dashboard/planning' : `/${locale}/dashboard/planning`
  return `${base}/${planId}`
}

function getAccessiblePlan(planId: string) {
  return db.query.groupTrainingPlans.findFirst({
    where: and(
      eq(groupTrainingPlans.id, planId),
      eq(groupTrainingPlans.isDeleted, false),
    ),
    with: { group: true },
  }).sync()
}

function resolvePlanKind(planningCohortId: string | null): GroupTrainingPlanKind {
  return planningCohortId === null ? 'group_base' : 'cohort_variant'
}

function requireAccessiblePlan(planId: string) {
  const plan = getAccessiblePlan(planId)

  if (!plan || plan.group.isDeleted || plan.group.teamId !== CURRENT_TEAM_ID) {
    return null
  }

  return plan
}

function forbiddenResult<T>(): CompetitionCalendarActionResult<T> {
  return {
    ok: false,
    errors: ['competition_calendar_plan_forbidden'],
    sameDateCompetitionIds: [],
  }
}

function revalidateCompetitionCalendar(locale: SupportedLocale, planId: string) {
  const listPath = locale === 'es' ? '/dashboard/planning' : `/${locale}/dashboard/planning`
  revalidatePath(listPath)
  revalidatePath(planningPath(locale, planId))
}

/** Returns the visible competition calendar only for plans owned by the current team. */
export async function getCompetitionCalendarAction(
  input: CompetitionCalendarActionContext,
): Promise<CompetitionCalendarActionResult<CompetitionEntry[]>> {
  if (!requireAccessiblePlan(input.planId)) return forbiddenResult()

  return {
    ok: true,
    value: getCompetitionCalendar(input.planId),
    sameDateCompetitionIds: [],
  }
}

/** Creates an entry for the whole audience represented by the owning plan. */
export async function createCompetitionAction(
  input: CreateCompetitionActionInput,
): Promise<CompetitionCalendarActionResult<CompetitionEntry>> {
  const plan = requireAccessiblePlan(input.planId)
  if (!plan) return forbiddenResult()

  const result = createCompetition({
    planId: plan.id,
    planKind: resolvePlanKind(plan.planningCohortId),
    coversEntirePlanAudience: true,
    draft: {
      ...input.draft,
      groupTrainingPlanId: plan.id,
    },
  })

  if (result.ok) revalidateCompetitionCalendar(input.locale ?? 'es', plan.id)
  return result
}

/** Updates mutable data without allowing edits to bypass lifecycle transitions. */
export async function updateCompetitionAction(
  input: UpdateCompetitionActionInput,
): Promise<CompetitionCalendarActionResult<CompetitionEntry>> {
  const plan = requireAccessiblePlan(input.planId)
  if (!plan) return forbiddenResult()

  const existing = getCompetitionCalendar(plan.id).find(({ id }) => id === input.competitionId)
  if (!existing) {
    return {
      ok: false,
      errors: ['competition_calendar_entry_not_found'],
      sameDateCompetitionIds: [],
    }
  }

  const result = updateCompetition({
    planId: plan.id,
    planKind: resolvePlanKind(plan.planningCohortId),
    coversEntirePlanAudience: true,
    competitionId: input.competitionId,
    draft: {
      ...input.draft,
      groupTrainingPlanId: plan.id,
      status: existing.status,
    },
  })

  if (result.ok) revalidateCompetitionCalendar(input.locale ?? 'es', plan.id)
  return result
}

/** Changes only the date and preserves lifecycle status. */
export async function rescheduleCompetitionAction(
  input: RescheduleCompetitionActionInput,
): Promise<CompetitionCalendarActionResult<CompetitionEntry>> {
  const plan = requireAccessiblePlan(input.planId)
  if (!plan) return forbiddenResult()

  const result = rescheduleCompetition({
    planId: plan.id,
    planKind: resolvePlanKind(plan.planningCohortId),
    coversEntirePlanAudience: true,
    competitionId: input.competitionId,
    date: input.date,
  })

  if (result.ok) revalidateCompetitionCalendar(input.locale ?? 'es', plan.id)
  return result
}

/** Applies one explicit lifecycle transition; cancellation never deletes the record. */
export async function changeCompetitionStatusAction(
  input: ChangeCompetitionStatusActionInput,
): Promise<CompetitionCalendarActionResult<CompetitionEntry>> {
  const plan = requireAccessiblePlan(input.planId)
  if (!plan) return forbiddenResult()

  const result = changeCompetitionStatus({
    planId: plan.id,
    planKind: resolvePlanKind(plan.planningCohortId),
    coversEntirePlanAudience: true,
    competitionId: input.competitionId,
    status: input.status,
  })

  if (result.ok) revalidateCompetitionCalendar(input.locale ?? 'es', plan.id)
  return result
}
