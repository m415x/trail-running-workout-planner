import { and, eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import type { AthleteGroupCode, Macrocycle } from '@/types'
import * as coreSchema from '@/db/schema'
import * as loadStrategySchema from '@/db/load-strategy-schema'
import * as intensityStrategySchema from '@/db/intensity-strategy-schema'
import * as sessionGenerationPreferencesSchema from '@/db/session-generation-preferences-schema'
import * as competitionEntrySchema from '@/db/competition-entry-schema'
import {
  groupTrainingPlans,
  planningCohorts,
  macrocycles,
  mesocycles,
  microcycles,
} from '@/db/schema'
import { loadStrategies } from '@/db/load-strategy-schema'
import {
  intensityStrategies,
  microcycleIntensityTargets,
} from '@/db/intensity-strategy-schema'
import { sessionGenerationPreferences } from '@/db/session-generation-preferences-schema'
import { competitionEntries } from '@/db/competition-entry-schema'

const variantPersistenceSchema = {
  ...coreSchema,
  ...loadStrategySchema,
  ...intensityStrategySchema,
  ...sessionGenerationPreferencesSchema,
  ...competitionEntrySchema,
}
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

      const sourcePlanAggregate = tx.query.groupTrainingPlans.findFirst({
        where: eq(groupTrainingPlans.id, sourcePlan.id),
        with: {
          macrocycles: {
            with: {
              mesocycles: {
                with: {
                  microcycles: true,
                },
              },
            },
          },
        },
      }).sync()

      if (!sourcePlanAggregate) {
        throw new PlanningVariantPersistenceError('Base plan aggregate not found')
      }

      const sourceLoadStrategy = tx
        .select()
        .from(loadStrategies)
        .where(and(
          eq(loadStrategies.groupTrainingPlanId, sourcePlan.id),
          eq(loadStrategies.isDeleted, false),
        ))
        .get()

      const sourceIntensityStrategy = tx
        .select()
        .from(intensityStrategies)
        .where(and(
          eq(intensityStrategies.groupTrainingPlanId, sourcePlan.id),
          eq(intensityStrategies.isDeleted, false),
        ))
        .get()

      const sourcePreferences = tx
        .select()
        .from(sessionGenerationPreferences)
        .where(and(
          eq(sessionGenerationPreferences.groupTrainingPlanId, sourcePlan.id),
          eq(sessionGenerationPreferences.isDeleted, false),
        ))
        .get()

      const sourceMicrocycleIds = sourcePlanAggregate.macrocycles.flatMap((macrocycle) =>
        macrocycle.mesocycles.flatMap((mesocycle) =>
          mesocycle.microcycles.map((microcycle) => microcycle.id),
        ),
      )

      const sourceTargets = sourceMicrocycleIds.length === 0
        ? []
        : tx
            .select()
            .from(microcycleIntensityTargets)
            .where(eq(microcycleIntensityTargets.isDeleted, false))
            .all()
            .filter((target) => sourceMicrocycleIds.includes(target.microcycleId))

      const sourceCompetitions = tx
        .select()
        .from(competitionEntries)
        .where(and(
          eq(competitionEntries.groupTrainingPlanId, sourcePlan.id),
          eq(competitionEntries.isDeleted, false),
        ))
        .all()

      const groupCode = `${sourcePlan.group.categoryCode}${sourcePlan.group.levelCode}` as AthleteGroupCode
      const sourceMacrocycles: Macrocycle[] = sourcePlanAggregate.macrocycles.map((macrocycle) => ({
        id: macrocycle.id,
        groupTrainingPlanId: macrocycle.groupTrainingPlanId,
        title: macrocycle.title,
        startDate: macrocycle.startDate,
        endDate: macrocycle.endDate,
        taperingWeeksCount:
          macrocycle.taperingWeeksCount === 0
          || macrocycle.taperingWeeksCount === 2
          || macrocycle.taperingWeeksCount === 3
            ? macrocycle.taperingWeeksCount
            : null,
        targetRaceName: macrocycle.targetRaceName,
        targetRaceDate: macrocycle.targetRaceDate,
        targetRaceDistanceKm: macrocycle.targetRaceDistanceKm,
        targetRaceElevationGain: macrocycle.targetRaceElevationGain,
        notes: macrocycle.notes,
        createdAt: macrocycle.createdAt,
        updatedAt: macrocycle.updatedAt,
        isDeleted: macrocycle.isDeleted,
        mesocycles: macrocycle.mesocycles.map((mesocycle) => ({
          id: mesocycle.id,
          macrocycleId: mesocycle.macrocycleId,
          title: mesocycle.title,
          number: mesocycle.number,
          period: mesocycle.period,
          objective: mesocycle.objective,
          createdAt: mesocycle.createdAt,
          updatedAt: mesocycle.updatedAt,
          isDeleted: mesocycle.isDeleted,
          microcycles: mesocycle.microcycles.map((microcycle) => ({
            id: microcycle.id,
            mesocycleId: microcycle.mesocycleId,
            weekNumber: microcycle.weekNumber,
            type: microcycle.type,
            startDate: microcycle.startDate,
            endDate: microcycle.endDate,
            targetVolumeKm: microcycle.targetVolumeKm,
            targetVolumeSource: microcycle.targetVolumeSource,
            targetElevationGain: microcycle.targetElevationGain,
            targetElevationSource: microcycle.targetElevationSource,
            targetDurationMin: microcycle.targetDurationMin,
            notes: microcycle.notes ?? undefined,
            createdAt: microcycle.createdAt,
            updatedAt: microcycle.updatedAt,
            isDeleted: microcycle.isDeleted,
          })),
        })),
      }))

      const derived = derivePlanningCohortVariant({
        source: {
          plan: {
            id: sourcePlanAggregate.id,
            groupId: sourcePlanAggregate.groupId,
            planningCohortId: sourcePlanAggregate.planningCohortId,
            sourceGroupTrainingPlanId: sourcePlanAggregate.sourceGroupTrainingPlanId,
            title: sourcePlanAggregate.title,
            status: sourcePlanAggregate.status,
            notes: sourcePlanAggregate.notes,
            createdAt: sourcePlanAggregate.createdAt,
            updatedAt: sourcePlanAggregate.updatedAt,
            isDeleted: sourcePlanAggregate.isDeleted,
            macrocycles: sourceMacrocycles,
          },
          loadStrategy: sourceLoadStrategy
            ? {
                id: sourceLoadStrategy.id,
                groupTrainingPlanId: sourceLoadStrategy.groupTrainingPlanId,
                context: {
                  athleteGroup: groupCode,
                  goalType: sourceLoadStrategy.goalType,
                },
                values: {
                  initialWeeklyVolumeKm: sourceLoadStrategy.initialWeeklyVolumeKm,
                  maximumWeeklyVolumeKm: sourceLoadStrategy.maximumWeeklyVolumeKm,
                  maximumWeeklyIncreasePercentage: sourceLoadStrategy.maximumWeeklyIncreasePercentage,
                  deloadPercentage: sourceLoadStrategy.deloadPercentage,
                  initialWeeklyElevationGain: sourceLoadStrategy.initialWeeklyElevationGain,
                  maximumWeeklyElevationGain: sourceLoadStrategy.maximumWeeklyElevationGain,
                },
                fieldSources: sourceLoadStrategy.fieldSources,
              }
            : null,
          intensityStrategy: sourceIntensityStrategy
            ? {
                id: sourceIntensityStrategy.id,
                groupTrainingPlanId: sourceIntensityStrategy.groupTrainingPlanId,
                context: {
                  athleteGroup: groupCode,
                  goalType: sourceIntensityStrategy.goalType,
                },
                values: {
                  defaultMethod: sourceIntensityStrategy.defaultMethod,
                  maximumIntenseSessionsPerWeek: sourceIntensityStrategy.maximumIntenseSessionsPerWeek,
                  minimumRecoveryDaysBetweenIntenseSessions:
                    sourceIntensityStrategy.minimumRecoveryDaysBetweenIntenseSessions,
                },
                fieldSources: sourceIntensityStrategy.fieldSources,
              }
            : null,
          sessionGenerationPreferences: sourcePreferences
            ? {
                id: sourcePreferences.id,
                groupTrainingPlanId: sourcePreferences.groupTrainingPlanId,
                frequencyMode: sourcePreferences.frequencyMode,
                fixedSessionsPerWeek: sourcePreferences.fixedSessionsPerWeek,
                weeklyPattern: sourcePreferences.weeklyPattern,
              }
            : null,
          microcycleIntensityTargets: sourceTargets,
          competitionEntries: sourceCompetitions,
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

      if (derived.loadStrategy) {
        tx.insert(loadStrategies).values({
          id: derived.loadStrategy.id,
          groupTrainingPlanId: derived.loadStrategy.groupTrainingPlanId,
          goalType: derived.loadStrategy.context.goalType,
          ...derived.loadStrategy.values,
          fieldSources: derived.loadStrategy.fieldSources,
          createdAt: now,
          updatedAt: now,
        }).run()
      }

      if (derived.intensityStrategy) {
        tx.insert(intensityStrategies).values({
          id: derived.intensityStrategy.id,
          groupTrainingPlanId: derived.intensityStrategy.groupTrainingPlanId,
          goalType: derived.intensityStrategy.context.goalType,
          ...derived.intensityStrategy.values,
          fieldSources: derived.intensityStrategy.fieldSources,
          createdAt: now,
          updatedAt: now,
        }).run()
      }

      if (derived.sessionGenerationPreferences) {
        tx.insert(sessionGenerationPreferences).values({
          ...derived.sessionGenerationPreferences,
          createdAt: now,
          updatedAt: now,
        }).run()
      }

      for (const macrocycle of derived.plan.macrocycles ?? []) {
        tx.insert(macrocycles).values({
          id: macrocycle.id,
          groupTrainingPlanId: macrocycle.groupTrainingPlanId,
          title: macrocycle.title,
          startDate: macrocycle.startDate,
          endDate: macrocycle.endDate,
          taperingWeeksCount: macrocycle.taperingWeeksCount ?? null,
          targetRaceName: macrocycle.targetRaceName ?? null,
          targetRaceDate: macrocycle.targetRaceDate ?? null,
          targetRaceDistanceKm: macrocycle.targetRaceDistanceKm ?? null,
          targetRaceElevationGain: macrocycle.targetRaceElevationGain ?? null,
          notes: macrocycle.notes ?? null,
          createdAt: now,
          updatedAt: now,
        }).run()

        for (const mesocycle of macrocycle.mesocycles ?? []) {
          tx.insert(mesocycles).values({
            id: mesocycle.id,
            macrocycleId: mesocycle.macrocycleId,
            title: mesocycle.title,
            number: mesocycle.number,
            period: mesocycle.period,
            objective: mesocycle.objective,
            createdAt: now,
            updatedAt: now,
          }).run()

          for (const microcycle of mesocycle.microcycles ?? []) {
            tx.insert(microcycles).values({
              id: microcycle.id,
              mesocycleId: microcycle.mesocycleId,
              weekNumber: microcycle.weekNumber,
              type: microcycle.type,
              startDate: microcycle.startDate,
              endDate: microcycle.endDate,
              targetVolumeKm: microcycle.targetVolumeKm ?? null,
              targetVolumeSource: microcycle.targetVolumeSource,
              targetElevationGain: microcycle.targetElevationGain ?? null,
              targetElevationSource: microcycle.targetElevationSource,
              targetDurationMin: microcycle.targetDurationMin ?? null,
              notes: microcycle.notes ?? null,
              createdAt: now,
              updatedAt: now,
            }).run()
          }
        }
      }

      for (const target of derived.microcycleIntensityTargets) {
        tx.insert(microcycleIntensityTargets).values({
          id: target.id,
          microcycleId: target.microcycleId,
          emphasis: target.emphasis,
          intenseSessionsTarget: target.intenseSessionsTarget,
          predominantZone: target.predominantZone,
          referencePercentageTarget: target.referencePercentageTarget,
          minimumRecoveryDaysBetweenIntenseSessions:
            target.minimumRecoveryDaysBetweenIntenseSessions,
          fieldSources: target.fieldSources,
          createdAt: now,
          updatedAt: now,
        }).run()
      }

      for (const competition of derived.competitionEntries) {
        tx.insert(competitionEntries).values({
          id: competition.id,
          groupTrainingPlanId: competition.groupTrainingPlanId,
          name: competition.name,
          date: competition.date,
          distanceKm: competition.distanceKm,
          elevationGainM: competition.elevationGainM ?? null,
          priority: competition.priority,
          status: competition.status,
          description: competition.description ?? null,
          createdAt: now,
          updatedAt: now,
        }).run()
      }

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
