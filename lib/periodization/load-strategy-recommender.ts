import {
  GROUP_ELEVATION_METERS_PER_KM,
  GROUP_VOLUME_MATRIX,
} from '@/data/periodization-matrix'
import { resolveLegacyPlanningIntent } from '@/lib/periodization/planning-intent'

import type {
  AthleteCategoryCode,
  AthleteGroupCode,
  LoadStrategyDraft,
  LoadStrategyFieldSources,
  PlanningIntent,
  TrainingGoalType,
} from '@/types'

interface PlanningIntentLoadProfile {
  initialVolume: 'range_min' | 'base'
  maximumVolume: 'base' | 'development' | 'shock' | 'range_max'
  maximumWeeklyIncreasePercentage: number
  deloadPercentage: number
}

/**
 * Group-planning load defaults are governed by PlanningIntent.
 * Competition context is deliberately absent: a race can affect periodization
 * without redefining the underlying load-development intent.
 */
const PLANNING_INTENT_LOAD_PROFILES: Record<PlanningIntent, PlanningIntentLoadProfile> = {
  development: {
    initialVolume: 'base',
    maximumVolume: 'shock',
    maximumWeeklyIncreasePercentage: 10,
    deloadPercentage: 25,
  },
  base: {
    initialVolume: 'range_min',
    maximumVolume: 'development',
    maximumWeeklyIncreasePercentage: 8,
    deloadPercentage: 20,
  },
  maintenance: {
    initialVolume: 'range_min',
    maximumVolume: 'base',
    maximumWeeklyIncreasePercentage: 5,
    deloadPercentage: 15,
  },
}

const SUGGESTED_FIELD_SOURCES: LoadStrategyFieldSources = {
  initialWeeklyVolumeKm: 'suggested',
  maximumWeeklyVolumeKm: 'suggested',
  maximumWeeklyIncreasePercentage: 'suggested',
  deloadPercentage: 'suggested',
  initialWeeklyElevationGain: 'suggested',
  maximumWeeklyElevationGain: 'suggested',
}

function buildSuggestedLoadStrategy(
  athleteGroup: AthleteGroupCode,
  planningIntent: PlanningIntent,
  legacyGoalType: TrainingGoalType,
): LoadStrategyDraft {
  const groupDefaults = GROUP_VOLUME_MATRIX[athleteGroup]
  const intentProfile = PLANNING_INTENT_LOAD_PROFILES[planningIntent]
  const initialWeeklyVolumeKm = intentProfile.initialVolume === 'base'
    ? groupDefaults.volumes.base
    : groupDefaults.range.min
  const maximumWeeklyVolumeKm = intentProfile.maximumVolume === 'range_max'
    ? groupDefaults.range.max
    : groupDefaults.volumes[intentProfile.maximumVolume]
  const category = athleteGroup.charAt(0) as AthleteCategoryCode
  const elevationMetersPerKm = GROUP_ELEVATION_METERS_PER_KM[category]

  return {
    context: {
      athleteGroup,
      // Transitional persistence metadata only. It does not select the profile.
      goalType: legacyGoalType,
    },
    values: {
      initialWeeklyVolumeKm,
      maximumWeeklyVolumeKm,
      maximumWeeklyIncreasePercentage: intentProfile.maximumWeeklyIncreasePercentage,
      deloadPercentage: intentProfile.deloadPercentage,
      initialWeeklyElevationGain: Math.round(initialWeeklyVolumeKm * elevationMetersPerKm),
      maximumWeeklyElevationGain: Math.round(maximumWeeklyVolumeKm * elevationMetersPerKm),
    },
    fieldSources: { ...SUGGESTED_FIELD_SOURCES },
  }
}

/** Primary H9 recommender for group planning. */
export function suggestLoadStrategyForPlanningIntent(
  athleteGroup: AthleteGroupCode,
  planningIntent: PlanningIntent,
  legacyGoalType: TrainingGoalType,
): LoadStrategyDraft {
  return buildSuggestedLoadStrategy(athleteGroup, planningIntent, legacyGoalType)
}

/**
 * Legacy compatibility wrapper.
 *
 * `race` and `performance` both resolve to `development`; therefore a legacy
 * race label cannot create a distinct load-planning policy.
 */
export function suggestLoadStrategy(
  athleteGroup: AthleteGroupCode,
  goalType: TrainingGoalType,
): LoadStrategyDraft {
  return buildSuggestedLoadStrategy(
    athleteGroup,
    resolveLegacyPlanningIntent(goalType),
    goalType,
  )
}
