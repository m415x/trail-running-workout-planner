import {
  GROUP_ELEVATION_METERS_PER_KM,
  GROUP_VOLUME_MATRIX,
} from '@/data/periodization-matrix'

import type {
  AthleteCategoryCode,
  AthleteGroupCode,
  LoadStrategyDraft,
  LoadStrategyFieldSources,
  TrainingGoalType,
} from '@/types'

interface GoalLoadProfile {
  initialVolume: 'range_min' | 'base'
  maximumVolume: 'base' | 'development' | 'shock' | 'range_max'
  maximumWeeklyIncreasePercentage: number
  deloadPercentage: number
}

const GOAL_LOAD_PROFILES: Record<TrainingGoalType, GoalLoadProfile> = {
  race: {
    initialVolume: 'base',
    maximumVolume: 'shock',
    maximumWeeklyIncreasePercentage: 10,
    deloadPercentage: 35,
  },
  performance: {
    initialVolume: 'base',
    maximumVolume: 'shock',
    maximumWeeklyIncreasePercentage: 10,
    deloadPercentage: 30,
  },
  base: {
    initialVolume: 'range_min',
    maximumVolume: 'development',
    maximumWeeklyIncreasePercentage: 8,
    deloadPercentage: 25,
  },
  maintenance: {
    initialVolume: 'range_min',
    maximumVolume: 'base',
    maximumWeeklyIncreasePercentage: 5,
    deloadPercentage: 20,
  },
  custom: {
    initialVolume: 'range_min',
    maximumVolume: 'range_max',
    maximumWeeklyIncreasePercentage: 10,
    deloadPercentage: 30,
  },
}

const SUGGESTED_FIELD_SOURCES: LoadStrategyFieldSources = {
  initialWeeklyVolumeKm: 'suggested',
  maximumWeeklyVolumeKm: 'suggested',
  sessionsPerWeek: 'suggested',
  maximumWeeklyIncreasePercentage: 'suggested',
  deloadPercentage: 'suggested',
  initialWeeklyElevationGain: 'suggested',
  maximumWeeklyElevationGain: 'suggested',
}

function getSessionsPerWeek(maximumWeeklyVolumeKm: number) {
  if (maximumWeeklyVolumeKm >= 85) return 6
  if (maximumWeeklyVolumeKm >= 60) return 5
  if (maximumWeeklyVolumeKm >= 40) return 4
  return 3
}

export function suggestLoadStrategy(
  athleteGroup: AthleteGroupCode,
  goalType: TrainingGoalType,
): LoadStrategyDraft {
  const groupDefaults = GROUP_VOLUME_MATRIX[athleteGroup]
  const goalProfile = GOAL_LOAD_PROFILES[goalType]
  const initialWeeklyVolumeKm = goalProfile.initialVolume === 'base'
    ? groupDefaults.volumes.base
    : groupDefaults.range.min
  const maximumWeeklyVolumeKm = goalProfile.maximumVolume === 'range_max'
    ? groupDefaults.range.max
    : groupDefaults.volumes[goalProfile.maximumVolume]
  const category = athleteGroup.charAt(0) as AthleteCategoryCode
  const elevationMetersPerKm = GROUP_ELEVATION_METERS_PER_KM[category]

  return {
    context: {
      athleteGroup,
      goalType,
    },
    values: {
      initialWeeklyVolumeKm,
      maximumWeeklyVolumeKm,
      sessionsPerWeek: getSessionsPerWeek(maximumWeeklyVolumeKm),
      maximumWeeklyIncreasePercentage: goalProfile.maximumWeeklyIncreasePercentage,
      deloadPercentage: goalProfile.deloadPercentage,
      initialWeeklyElevationGain: Math.round(initialWeeklyVolumeKm * elevationMetersPerKm),
      maximumWeeklyElevationGain: Math.round(maximumWeeklyVolumeKm * elevationMetersPerKm),
    },
    fieldSources: { ...SUGGESTED_FIELD_SOURCES },
  }
}
