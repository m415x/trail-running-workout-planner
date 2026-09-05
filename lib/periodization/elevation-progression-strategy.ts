import type {
  ElevationProgressionStrategy,
  LoadStrategyDraft,
} from '@/types'

/**
 * Resolves the effective vertical-gain strategy from a group load strategy.
 *
 * Category ratios belong to the recommendation step and are deliberately not
 * consulted here. When both elevation limits are absent, generation must keep
 * D+ disabled instead of silently restoring a category-derived value.
 *
 * @throws {Error} When only one elevation limit exists, either limit is not a
 * non-negative integer, or the initial target exceeds the maximum target.
 */
export function resolveElevationProgressionStrategy(
  loadStrategy: LoadStrategyDraft,
): ElevationProgressionStrategy {
  const {
    initialWeeklyElevationGain,
    maximumWeeklyElevationGain,
    maximumWeeklyIncreasePercentage,
    deloadPercentage,
  } = loadStrategy.values

  if (
    initialWeeklyElevationGain === null
    && maximumWeeklyElevationGain === null
  ) {
    return { mode: 'disabled', reason: 'not_configured' }
  }

  if (
    initialWeeklyElevationGain === null
    || maximumWeeklyElevationGain === null
  ) {
    throw new Error('El desnivel inicial y máximo deben estar configurados juntos.')
  }

  if (
    !Number.isInteger(initialWeeklyElevationGain)
    || initialWeeklyElevationGain < 0
    || !Number.isInteger(maximumWeeklyElevationGain)
    || maximumWeeklyElevationGain < 0
  ) {
    throw new Error('Los objetivos de desnivel deben ser metros enteros no negativos.')
  }

  if (initialWeeklyElevationGain > maximumWeeklyElevationGain) {
    throw new Error('El desnivel inicial no puede superar el desnivel máximo.')
  }

  return {
    mode: 'progressive',
    initial: {
      elevationGainM: initialWeeklyElevationGain,
      source: loadStrategy.fieldSources.initialWeeklyElevationGain,
    },
    maximum: {
      elevationGainM: maximumWeeklyElevationGain,
      source: loadStrategy.fieldSources.maximumWeeklyElevationGain,
    },
    maximumWeeklyIncreasePercentage,
    deloadPercentage,
  }
}
