import { and, eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import * as coreSchema from '@/db/schema'
import { groupTrainingPlans, planningCohorts } from '@/db/schema'
import {
  derivePlanningCohortVariant,
  PlanningVariantDerivationError,
} from '@/lib/planning-cohorts/plan-derivation'

export class PlanningVariantPersistenceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlanningVariantPersistenceError'
  }
}

export function persistPlanningCohortVariantSynchronously(input: {
  db: BetterSQLite3Database<typeof coreSchema>
  teamId: string
  cohortId: string
  sourcePlanId: string
  title: string
  selectedCompetitionEntryIds: readonly string[]
  createId: () => string
  now: () => string
}) {
  try {
    return input.db.transaction((tx) => {
      const cohort = tx.query.planningCohorts.findFirst({
        where: and(
          eq(planningCohorts.id, input.cohortId),
          eq(planningCohorts.teamId, input.teamId),
          eq(planningCohorts.isDeleted, false),
        ),
      }).sync()

      if (!cohort) {
        throw new PlanningVariantPersistenceError('Planning subgroup not found in team scope')
      }

      if (cohort.status !== 'active') {
        throw new PlanningVariantPersistenceError('Planning subgroup must be active')
      }

      const sourcePlan = tx.query.groupTrainingPlans.findFirst({
        where: and(
          eq(groupTrainingPlans.id, input.sourcePlanId),
          eq(groupTrainingPlans.isDeleted, false),
        ),
        with: {
          group: true,
        },
      }).sync()

      if (!sourcePlan || sourcePlan.group.teamId !== input.teamId || sourcePlan.group.isDeleted) {
        throw new PlanningVariantPersistenceError('Base plan not found in team scope')
      }

      if (
        sourcePlan.planningCohortId !== null
        || sourcePlan.sourceGroupTrainingPlanId !== null
      ) {
        throw new PlanningVariantPersistenceError('Variant source must be a direct base plan')
      }

      if (sourcePlan.groupId !== cohort.groupId) {
        throw new PlanningVariantPersistenceError('Base plan and planning subgroup must share sporting group')
      }

      const existingVariant = tx.query.groupTrainingPlans.findFirst({
        where: and(
          eq(groupTrainingPlans.planningCohortId, cohort.id),
          eq(groupTrainingPlans.isDeleted, false),
        ),
      }).sync()

      if (existingVariant) {
        throw new PlanningVariantPersistenceError('Planning subgroup already has a variant')
      }

      const derived = derivePlanningCohortVariant({
        source: {
          plan: {
            id: sourcePlan.id,
            groupId: sourcePlan.groupId,
            planningCohortId: sourcePlan.planningCohortId,
            sourceGroupTrainingPlanId: sourcePlan.sourceGroupTrainingPlanId,
            title: sourcePlan.title,
            status: sourcePlan.status,
            notes: sourcePlan.notes,
          },
          loadStrategy: null,
          intensityStrategy: null,
          sessionGenerationPreferences: null,
          microcycleIntensityTargets: [],
          competitionEntries: [],
        },
        cohort: {
          id: cohort.id,
          teamId: cohort.teamId,
          groupId: cohort.groupId,
          name: cohort.name,
          purpose: cohort.purpose,
          description: cohort.description,
          status: cohort.status,
        },
        title: input.title,
        selectedCompetitionEntryIds: input.selectedCompetitionEntryIds,
        createId: input.createId,
      })

      const now = input.now()
      tx.insert(groupTrainingPlans).values({
        id: derived.plan.id,
        groupId: derived.plan.groupId,
        planningCohortId: derived.plan.planningCohortId,
        sourceGroupTrainingPlanId: derived.plan.sourceGroupTrainingPlanId,
        title: derived.plan.title,
        status: 'draft',
        notes: derived.plan.notes ?? null,
        createdAt: now,
        updatedAt: now,
      }).run()

      return {
        planId: derived.plan.id,
        cohortId: cohort.id,
        sourcePlanId: sourcePlan.id,
      }
    })
  } catch (error) {
    if (error instanceof PlanningVariantPersistenceError) throw error
    if (error instanceof PlanningVariantDerivationError) {
      throw new PlanningVariantPersistenceError(error.message)
    }

    throw error
  }
}
