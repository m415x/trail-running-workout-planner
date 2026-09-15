import {
  adaptAdherenceTrend,
  adaptInternalLoadSignal,
  adaptSystematicVolumeAssessment,
} from '@/lib/training-response/training-response-adapters'
import { composeTrainingResponseReview } from '@/lib/training-response/training-response-convergence'
import type {
  AthleteAdherenceTrend,
  AthleteSystematicVolumeAssessment,
  InternalLoadSignal,
  TrainingResponseLimitation,
  TrainingResponseReview,
} from '@/types'

export interface BuildAthleteTrainingResponseReviewInput {
  readonly systematicVolume: AthleteSystematicVolumeAssessment
  readonly internalLoad: InternalLoadSignal
  readonly adherence: AthleteAdherenceTrend
}

/**
 * Integrates existing semantic source outputs into the versioned coach-review
 * convergence layer without recalculating or reinterpreting source metrics.
 */
export function buildAthleteTrainingResponseReview(
  input: BuildAthleteTrainingResponseReviewInput,
): TrainingResponseReview {
  const sources = [
    adaptSystematicVolumeAssessment(input.systematicVolume),
    adaptInternalLoadSignal(input.internalLoad),
    adaptAdherenceTrend(input.adherence),
  ]

  const contributors = sources.flatMap(source => source.contributors)
  const limitations = sources
    .flatMap(source => source.limitations)
    .filter((limitation, index, all) => all.indexOf(limitation) === index) as TrainingResponseLimitation[]

  return composeTrainingResponseReview({ contributors, limitations })
}
