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

  return progression.volumes[params.type]
}
