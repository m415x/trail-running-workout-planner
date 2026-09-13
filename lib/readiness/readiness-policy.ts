import type { ReadinessPolicy } from '@/types/training/readiness-policy.types'

function assertRatio(name: string, value: number, input: { min?: number; max?: number } = {}): void {
  const min = input.min ?? 0
  const max = input.max ?? 1
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be finite and between ${min} and ${max}`)
  }
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
}

export function validateReadinessPolicy(policy: ReadinessPolicy): ReadinessPolicy {
  if (policy.version.trim().length === 0) throw new Error('Readiness policy version is required')

  assertPositiveInteger('lookbackDays', policy.dataSufficiency.lookbackDays)
  assertPositiveInteger('bucketDays', policy.dataSufficiency.bucketDays)
  if (!Number.isInteger(policy.dataSufficiency.minimumPerformedSessions)
    || policy.dataSufficiency.minimumPerformedSessions < 0) {
    throw new Error('minimumPerformedSessions must be a non-negative integer')
  }
  if (!Number.isInteger(policy.dataSufficiency.minimumActiveBuckets)
    || policy.dataSufficiency.minimumActiveBuckets < 0) {
    throw new Error('minimumActiveBuckets must be a non-negative integer')
  }
  assertRatio('minimumMetricCoverageRatio', policy.dataSufficiency.minimumMetricCoverageRatio)
  assertRatio('minimumActiveBucketRatio', policy.continuity.minimumActiveBucketRatio)
  assertRatio(
    'minimumLongestDistanceToRaceRatio',
    policy.competitionExposure.minimumLongestDistanceToRaceRatio,
  )
  assertRatio(
    'minimumPeakElevationToRaceRatio',
    policy.competitionExposure.minimumPeakElevationToRaceRatio,
  )
  assertPositiveInteger('minimumLinkedSessions', policy.planVsReal.minimumLinkedSessions)
  assertRatio('relativeDeviationThreshold', policy.planVsReal.relativeDeviationThreshold)
  assertPositiveInteger(
    'comparableSessionLookbackCount',
    policy.predictedSessionJump.comparableSessionLookbackCount,
  )
  assertRatio('distanceIncreaseRatioThreshold', policy.predictedSessionJump.distanceIncreaseRatioThreshold, { max: 10 })
  assertRatio('durationIncreaseRatioThreshold', policy.predictedSessionJump.durationIncreaseRatioThreshold, { max: 10 })
  assertRatio('elevationIncreaseRatioThreshold', policy.predictedSessionJump.elevationIncreaseRatioThreshold, { max: 10 })
  assertPositiveInteger(
    'minimumWeeklyPerformedSessions',
    policy.longRunConcentration.minimumWeeklyPerformedSessions,
  )
  assertRatio('maximumVolumeRatio', policy.longRunConcentration.maximumVolumeRatio)
  assertRatio('maximumDurationRatio', policy.longRunConcentration.maximumDurationRatio)

  return policy
}

/**
 * Draft product policy used to develop H12 deterministically before the coach
 * approves/adjusts the concrete thresholds. Its status must remain `draft`
 * until that review happens; it is not a clinical standard.
 */
export const H12_READINESS_POLICY_DRAFT_V1 = validateReadinessPolicy({
  version: 'h12-readiness-v1-draft',
  status: 'draft',
  dataSufficiency: {
    lookbackDays: 28,
    bucketDays: 7,
    minimumPerformedSessions: 6,
    minimumActiveBuckets: 3,
    minimumMetricCoverageRatio: 0.75,
  },
  continuity: {
    minimumActiveBucketRatio: 0.75,
  },
  competitionExposure: {
    minimumLongestDistanceToRaceRatio: 0.50,
    minimumPeakElevationToRaceRatio: 0.50,
  },
  planVsReal: {
    minimumLinkedSessions: 4,
    relativeDeviationThreshold: 0.30,
  },
  predictedSessionJump: {
    comparableSessionLookbackCount: 4,
    distanceIncreaseRatioThreshold: 0.50,
    durationIncreaseRatioThreshold: 0.50,
    elevationIncreaseRatioThreshold: 0.50,
  },
  longRunConcentration: {
    minimumWeeklyPerformedSessions: 3,
    maximumVolumeRatio: 0.50,
    maximumDurationRatio: 0.50,
  },
  suppressExpectedTaperReductionAlerts: true,
  suppressExpectedRecoveryReductionAlerts: true,
})
