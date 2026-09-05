import type { ElevationProgressionStrategy } from '@/types'

export interface MesocycleElevationTarget {
  mesocycleNumber: number
  targetPeakElevationGain: number | null
}

export interface MesocycleElevationTargetParams {
  strategy: ElevationProgressionStrategy
  mesocycleCount: number
}

/**
 * Calculates the progressive D+ peak assigned to each training mesocycle.
 *
 * Values are positive elevation meters per week and are rounded to whole
 * meters. A disabled strategy returns one null target per mesocycle so callers
 * can preserve the planning structure without inventing elevation values.
 * This function does not distribute the targets among microcycles.
 *
 * @throws {Error} When `mesocycleCount` is not a positive integer.
 */
export function calculateMesocycleElevationTargets({
  strategy,
  mesocycleCount,
}: MesocycleElevationTargetParams): MesocycleElevationTarget[] {
  if (!Number.isInteger(mesocycleCount) || mesocycleCount < 1) {
    throw new Error('La cantidad de mesociclos debe ser un entero mayor que cero.')
  }

  if (strategy.mode === 'disabled') {
    return Array.from({ length: mesocycleCount }, (_, index) => ({
      mesocycleNumber: index + 1,
      targetPeakElevationGain: null,
    }))
  }

  const availableIncrease = strategy.maximum.elevationGainM
    - strategy.initial.elevationGainM

  return Array.from({ length: mesocycleCount }, (_, index) => ({
    mesocycleNumber: index + 1,
    targetPeakElevationGain: Math.round(
      strategy.initial.elevationGainM
        + availableIncrease * ((index + 1) / mesocycleCount),
    ),
  }))
}
