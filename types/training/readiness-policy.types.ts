import type { ReadinessDataSufficiencyPolicy } from '@/types/training/readiness.types'

export interface ReadinessPolicy {
  readonly version: string
  readonly status: 'draft' | 'active'
  readonly dataSufficiency: ReadinessDataSufficiencyPolicy
  readonly continuity: {
    readonly minimumActiveBucketRatio: number
  }
  readonly competitionExposure: {
    /** Product review criterion, not a universal race-distance readiness formula. */
    readonly minimumLongestDistanceToRaceRatio: number
    /** Product review criterion comparing known recent single-session D+ to race D+. */
    readonly minimumPeakElevationToRaceRatio: number
  }
  readonly planVsReal: {
    readonly minimumLinkedSessions: number
    readonly relativeDeviationThreshold: number
  }
  readonly predictedSessionJump: {
    readonly comparableSessionLookbackCount: number
    readonly distanceIncreaseRatioThreshold: number
    readonly durationIncreaseRatioThreshold: number
    readonly elevationIncreaseRatioThreshold: number
  }
  readonly longRunConcentration: {
    readonly minimumWeeklyPerformedSessions: number
    readonly maximumVolumeRatio: number
    readonly maximumDurationRatio: number
  }
  readonly suppressExpectedTaperReductionAlerts: boolean
  readonly suppressExpectedRecoveryReductionAlerts: boolean
}
