import type {
  SystematicVolumeAttention,
  SystematicVolumeMicrocycleEvidence,
  SystematicVolumePattern,
  SystematicVolumeRuleConfig,
} from '@/types/training/systematic-volume-excess.types'
import { SYSTEMATIC_VOLUME_RULE_CONFIG } from '@/types/training/systematic-volume-excess.types'

export interface SystematicVolumePatternEvaluation {
  readonly pattern: SystematicVolumePattern
  readonly attention: SystematicVolumeAttention
  readonly contributingMicrocycleIds: readonly string[]
}

export function hasMaterialVolumeExcess(evidence: SystematicVolumeMicrocycleEvidence): boolean {
  return evidence.evaluable && evidence.magnitude !== null && evidence.magnitude.absoluteDelta > 0
}

export function evaluateSystematicVolumePattern(
  current: SystematicVolumeMicrocycleEvidence | null,
  previousEvaluable: SystematicVolumeMicrocycleEvidence | null,
  config: SystematicVolumeRuleConfig = SYSTEMATIC_VOLUME_RULE_CONFIG,
): SystematicVolumePatternEvaluation {
  if (!current || !current.evaluable) {
    return {
      pattern: 'insufficient_data',
      attention: 'none',
      contributingMicrocycleIds: [],
    }
  }

  if (!hasMaterialVolumeExcess(current)) {
    return {
      pattern: 'within_plan',
      attention: 'none',
      contributingMicrocycleIds: [current.microcycleId],
    }
  }

  const persistenceReached =
    config.consecutiveEvaluableMicrocycles === 2 &&
    previousEvaluable !== null &&
    previousEvaluable.dimension === current.dimension &&
    hasMaterialVolumeExcess(previousEvaluable)

  if (persistenceReached) {
    return {
      pattern: 'systematic_excess',
      attention: 'review',
      contributingMicrocycleIds: [previousEvaluable.microcycleId, current.microcycleId],
    }
  }

  return {
    pattern: 'isolated_excess',
    attention: 'info',
    contributingMicrocycleIds: [current.microcycleId],
  }
}
