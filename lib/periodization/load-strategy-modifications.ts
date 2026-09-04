import type {
  LoadStrategyField,
  LoadStrategyValues,
  PlanningModificationField,
} from '@/types'

export interface LoadStrategyModification {
  field: PlanningModificationField
  previousValue: string | null
  newValue: string | null
}

const modificationFields: Record<LoadStrategyField, PlanningModificationField> = {
  initialWeeklyVolumeKm: 'load_initial_weekly_volume_km',
  maximumWeeklyVolumeKm: 'load_maximum_weekly_volume_km',
  sessionsPerWeek: 'load_sessions_per_week',
  maximumWeeklyIncreasePercentage: 'load_maximum_weekly_increase_percentage',
  deloadPercentage: 'load_deload_percentage',
  initialWeeklyElevationGain: 'load_initial_weekly_elevation_gain',
  maximumWeeklyElevationGain: 'load_maximum_weekly_elevation_gain',
}

const loadStrategyFields = Object.keys(modificationFields) as LoadStrategyField[]

function serializeModificationValue(value: number | null) {
  return value === null ? null : String(value)
}

export function getLoadStrategyModifications(
  suggestedValues: LoadStrategyValues,
  actualValues: LoadStrategyValues,
): LoadStrategyModification[] {
  return loadStrategyFields.flatMap((field) => {
    const previousValue = suggestedValues[field]
    const newValue = actualValues[field]

    if (previousValue === newValue) {
      return []
    }

    return [{
      field: modificationFields[field],
      previousValue: serializeModificationValue(previousValue),
      newValue: serializeModificationValue(newValue),
    }]
  })
}
