import { evaluateSystematicVolumePattern } from '@/lib/systematic-volume/systematic-volume-policy'
import type {
  AthleteSystematicVolumeAssessment,
  SystematicVolumeAttention,
  SystematicVolumeDimension,
  SystematicVolumeMicrocycleEvidence,
  SystematicVolumeSignal,
} from '@/types'
import {
  SYSTEMATIC_VOLUME_RULE_CONFIG,
  SYSTEMATIC_VOLUME_RULE_VERSION,
} from '@/types/training/systematic-volume-excess.types'

const ATTENTION_RANK: Readonly<Record<SystematicVolumeAttention, number>> = {
  none: 0,
  info: 1,
  review: 2,
  priority: 3,
}

function evidenceForDimension(
  series: readonly SystematicVolumeMicrocycleEvidence[],
  dimension: SystematicVolumeDimension,
) {
  return series
    .filter(item => item.dimension === dimension)
    .sort((first, second) => first.startDate.localeCompare(second.startDate))
}

function buildSignal(
  athleteId: string,
  dimension: SystematicVolumeDimension,
  series: readonly SystematicVolumeMicrocycleEvidence[],
): SystematicVolumeSignal {
  const dimensionSeries = evidenceForDimension(series, dimension)
  const current = dimensionSeries.at(-1) ?? null
  const previous = dimensionSeries.length > 1 ? dimensionSeries.at(-2) ?? null : null

  // Persistence is consecutive in time, not merely the two most recent valid rows.
  // An unevaluable microcycle therefore breaks the pattern instead of being skipped.
  const previousEvaluable = previous?.evaluable ? previous : null
  const evaluation = evaluateSystematicVolumePattern(current, previousEvaluable)

  return {
    athleteId,
    dimension,
    pattern: evaluation.pattern,
    attention: evaluation.attention,
    ruleVersion: SYSTEMATIC_VOLUME_RULE_VERSION,
    current,
    previousEvaluable,
    contributingMicrocycleIds: evaluation.contributingMicrocycleIds,
    insufficientReasons: current?.insufficientReasons ?? [],
  }
}

export function buildAthleteSystematicVolumeAssessment(
  athleteId: string,
  series: readonly SystematicVolumeMicrocycleEvidence[],
): AthleteSystematicVolumeAssessment {
  const signals = Object.fromEntries(
    SYSTEMATIC_VOLUME_RULE_CONFIG.dimensions.map(dimension => [
      dimension,
      buildSignal(athleteId, dimension, series),
    ]),
  ) as Readonly<Record<SystematicVolumeDimension, SystematicVolumeSignal>>

  const ranked = SYSTEMATIC_VOLUME_RULE_CONFIG.dimensions
    .map(dimension => signals[dimension])
    .sort((first, second) => {
      const attentionOrder = ATTENTION_RANK[second.attention] - ATTENTION_RANK[first.attention]
      if (attentionOrder !== 0) return attentionOrder

      const secondDelta = second.current?.magnitude?.relativeDeltaPercent ?? Number.NEGATIVE_INFINITY
      const firstDelta = first.current?.magnitude?.relativeDeltaPercent ?? Number.NEGATIVE_INFINITY
      return secondDelta - firstDelta
    })

  const primary = ranked.find(signal => signal.attention !== 'none') ?? null

  return {
    athleteId,
    ruleVersion: SYSTEMATIC_VOLUME_RULE_VERSION,
    signals,
    primaryDimension: primary?.dimension ?? null,
    attention: primary?.attention ?? 'none',
  }
}
