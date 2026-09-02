import { GROUP_VOLUME_MATRIX } from '@/data/periodization-matrix'

import type {
  AthleteGroupCode,
  VolumeMatrixMicrocycleType,
} from '@/types'

export type TargetVolumeCalculationParams =
  | {
      athleteGroup: AthleteGroupCode
      type: VolumeMatrixMicrocycleType
    }
  | {
      athleteGroup: AthleteGroupCode
      type: 'tapering'
      volumeFactor: number
    }
  | {
      athleteGroup: AthleteGroupCode
      type: 'race'
      raceDistanceKm: number
      supportingLoadFactor?: number
    }

function validateFactor(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new Error(`${fieldName} debe ser mayor que cero y menor o igual a uno.`)
  }
}

export function calculateTargetVolume(params: TargetVolumeCalculationParams): number {
  const progression = GROUP_VOLUME_MATRIX[params.athleteGroup]

  if (params.type === 'tapering') {
    validateFactor(params.volumeFactor, 'volumeFactor')
    return Math.round(progression.volumes.shock * params.volumeFactor)
  }

  if (params.type === 'race') {
    if (!Number.isFinite(params.raceDistanceKm) || params.raceDistanceKm <= 0) {
      throw new Error('raceDistanceKm debe ser mayor que cero.')
    }

    const supportingLoadFactor = params.supportingLoadFactor ?? 0.35
    validateFactor(supportingLoadFactor, 'supportingLoadFactor')

    return Math.max(
      params.raceDistanceKm,
      Math.round(progression.volumes.shock * supportingLoadFactor),
    )
  }

  return progression.volumes[params.type]
}
