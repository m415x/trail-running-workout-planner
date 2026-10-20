import type { db as sqliteDb } from '@/db/index'
import { loadStrategies } from '@/db/load-strategy-schema'
import { intensityStrategies } from '@/db/intensity-strategy-schema'
import { suggestLoadStrategy } from '@/lib/periodization/load-strategy-recommender'

type SeedDb = typeof sqliteDb

/** Planning-only strategies for the S2 hierarchy; no effective Session writes. */
export async function seedPlanStrategies(db: SeedDb): Promise<void> {
  const planId = 'group_plan_s2_12k'
  const suggested = suggestLoadStrategy('S2', 'race')

  await db.insert(loadStrategies).values({
    id: 'load_strategy_s2_12k',
    groupTrainingPlanId: planId,
    goalType: 'race',
    initialWeeklyVolumeKm: suggested.values.initialWeeklyVolumeKm,
    maximumWeeklyVolumeKm: suggested.values.maximumWeeklyVolumeKm,
    maximumWeeklyIncreasePercentage: suggested.values.maximumWeeklyIncreasePercentage,
    deloadPercentage: suggested.values.deloadPercentage,
    initialWeeklyElevationGain: suggested.values.initialWeeklyElevationGain,
    maximumWeeklyElevationGain: suggested.values.maximumWeeklyElevationGain,
    fieldSources: { ...suggested.fieldSources },
  }).onConflictDoNothing().run()

  await db.insert(intensityStrategies).values({
    id: 'intensity_strategy_s2_12k',
    groupTrainingPlanId: planId,
    goalType: 'race',
    defaultMethod: 'hr_zone',
    maximumIntenseSessionsPerWeek: 2,
    minimumRecoveryDaysBetweenIntenseSessions: 2,
    fieldSources: {
      defaultMethod: 'suggested',
      maximumIntenseSessionsPerWeek: 'suggested',
      minimumRecoveryDaysBetweenIntenseSessions: 'suggested',
    },
  }).onConflictDoNothing().run()
}
