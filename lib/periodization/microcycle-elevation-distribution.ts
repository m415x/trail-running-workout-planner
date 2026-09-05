import type { VolumeMatrixMicrocycleType } from '@/types'

export interface DistributedMicrocycleElevation {
  type: VolumeMatrixMicrocycleType
  targetElevationGain: number
}

export interface MicrocycleElevationDistributionParams {
  sequence: VolumeMatrixMicrocycleType[]
  startingElevationGain: number
  targetPeakElevationGain: number
  deloadPercentage: number
  maximumWeeklyIncreasePercentage: number
}

const ELEVATION_ROUNDING_STEP_M = 10

function roundElevation(value: number) {
  return Math.round(value / ELEVATION_ROUNDING_STEP_M) * ELEVATION_ROUNDING_STEP_M
}

function floorElevation(value: number) {
  return Math.floor(value / ELEVATION_ROUNDING_STEP_M) * ELEVATION_ROUNDING_STEP_M
}

/**
 * Distributes a mesocycle D+ target across its loading and deload weeks.
 *
 * Elevation values are positive meters per week. Generated intermediate values
 * are rounded to 10 m and never exceed the configured weekly increase after a
 * positive baseline. A deload does not lower the tolerated peak used to begin
 * the next block.
 *
 * @throws {Error} When the sequence or numeric constraints are invalid.
 */
export function distributeMesocycleElevation({
  sequence,
  startingElevationGain,
  targetPeakElevationGain,
  deloadPercentage,
  maximumWeeklyIncreasePercentage,
}: MicrocycleElevationDistributionParams): DistributedMicrocycleElevation[] {
  if (sequence.length === 0) {
    throw new Error('Se necesita al menos un microciclo para distribuir el desnivel.')
  }

  if (!Number.isInteger(startingElevationGain) || startingElevationGain < 0) {
    throw new Error('El desnivel inicial debe ser un entero no negativo.')
  }

  if (
    !Number.isInteger(targetPeakElevationGain)
    || targetPeakElevationGain < startingElevationGain
  ) {
    throw new Error('El pico de desnivel debe ser un entero igual o superior al inicial.')
  }

  if (
    !Number.isFinite(deloadPercentage)
    || deloadPercentage <= 0
    || deloadPercentage >= 100
  ) {
    throw new Error('El porcentaje de descarga debe ser mayor que cero y menor que 100.')
  }

  if (
    !Number.isFinite(maximumWeeklyIncreasePercentage)
    || maximumWeeklyIncreasePercentage <= 0
  ) {
    throw new Error('El incremento semanal máximo debe ser mayor que cero.')
  }

  const loadingWeeksCount = sequence.filter((type) => type !== 'deload').length

  if (loadingWeeksCount === 0) {
    throw new Error('El mesociclo debe incluir al menos una semana de carga.')
  }

  let loadingWeekIndex = 0
  let lastToleratedElevationGain = startingElevationGain

  return sequence.map((type) => {
    if (type === 'deload') {
      return {
        type,
        targetElevationGain: roundElevation(
          lastToleratedElevationGain * (1 - deloadPercentage / 100),
        ),
      }
    }

    const progress = loadingWeeksCount === 1
      ? 0
      : loadingWeekIndex / (loadingWeeksCount - 1)
    const proposedElevationGain = roundElevation(
      startingElevationGain
        + (targetPeakElevationGain - startingElevationGain) * progress,
    )
    const maximumAllowedElevationGain = lastToleratedElevationGain === 0
      ? proposedElevationGain
      : floorElevation(
          lastToleratedElevationGain * (1 + maximumWeeklyIncreasePercentage / 100),
        )
    const targetElevationGain = loadingWeekIndex === 0
      ? startingElevationGain
      : Math.min(
          proposedElevationGain,
          maximumAllowedElevationGain,
          targetPeakElevationGain,
        )

    loadingWeekIndex += 1
    lastToleratedElevationGain = targetElevationGain

    return { type, targetElevationGain }
  })
}
