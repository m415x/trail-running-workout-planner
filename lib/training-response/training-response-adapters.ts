import type {
  AthleteAdherenceTrend,
  AthleteSystematicVolumeAssessment,
  InternalLoadSignal,
  SystematicVolumeSignal,
  TrainingResponseContributor,
  TrainingResponseLimitation,
} from '@/types'

export interface TrainingResponseAdaptedSource {
  readonly contributors: readonly TrainingResponseContributor[]
  readonly limitations: readonly TrainingResponseLimitation[]
}

function volumeRank(signal: SystematicVolumeSignal): number {
  switch (signal.pattern) {
    case 'systematic_excess': return 3
    case 'isolated_excess': return 2
    case 'within_plan': return 1
    case 'insufficient_data': return 0
  }
}

/**
 * Adapts the multi-dimensional systematic-volume assessment into one source-domain
 * contributor. Multiple dimensions remain evidence inside one domain and therefore
 * cannot independently satisfy convergence.
 */
export function adaptSystematicVolumeAssessment(
  assessment: AthleteSystematicVolumeAssessment,
): TrainingResponseAdaptedSource {
  const signals = Object.values(assessment.signals)
  const knownSignals = signals.filter(signal => signal.pattern !== 'insufficient_data')
  const limitations: TrainingResponseLimitation[] = []

  if (knownSignals.length === 0) {
    limitations.push('systematic_volume_insufficient_data')
    return { contributors: [], limitations }
  }

  const strongest = [...knownSignals].sort((left, right) => volumeRank(right) - volumeRank(left))[0]!

  if (strongest.pattern === 'within_plan') {
    return { contributors: [], limitations }
  }

  return {
    contributors: [{
      domain: 'systematic_volume',
      signal: strongest.pattern,
      role: 'evidence',
      evidenceWindow: strongest.current === null
        ? null
        : { startDate: strongest.current.startDate, endDate: strongest.current.endDate },
      sourceRuleVersion: strongest.ruleVersion,
    }],
    limitations,
  }
}

/** Maps the KAN-344 semantic boundary without inspecting raw load-balance metrics. */
export function adaptInternalLoadSignal(
  signal: InternalLoadSignal,
): TrainingResponseAdaptedSource {
  if (signal.state === 'insufficient_data') {
    return {
      contributors: [],
      limitations: ['internal_load_insufficient_data'],
    }
  }

  if (signal.state === 'stable_or_lower') {
    return { contributors: [], limitations: [] }
  }

  return {
    contributors: [{
      domain: 'internal_load',
      signal: signal.state,
      role: 'evidence',
      evidenceWindow: { startDate: signal.startDate, endDate: signal.endDate },
      sourceRuleVersion: signal.signalRuleVersion,
    }],
    limitations: [],
  }
}

/** Adherence is contextual in convergence-v1 and can never establish priority itself. */
export function adaptAdherenceTrend(
  trend: AthleteAdherenceTrend,
): TrainingResponseAdaptedSource {
  if (trend.state === 'insufficient_data') {
    return {
      contributors: [],
      limitations: ['adherence_insufficient_data'],
    }
  }

  if (trend.points.length === 0) {
    return {
      contributors: [],
      limitations: ['adherence_insufficient_data'],
    }
  }

  const first = trend.points[0]!
  const last = trend.points[trend.points.length - 1]!

  return {
    contributors: [{
      domain: 'adherence',
      signal: trend.direction,
      role: 'context',
      evidenceWindow: {
        startDate: first.window.startDate,
        endDate: last.window.endDate,
      },
      sourceRuleVersion: trend.rule.version,
    }],
    limitations: [],
  }
}
