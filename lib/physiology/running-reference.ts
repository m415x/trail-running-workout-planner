import {
  deriveTrack1000mPerformance,
  type FieldPerformanceTestProtocol,
} from '@/lib/physiology/field-performance-test'

export interface RunningReferenceEvidence {
  evaluationId: string
  performedAt: string
  createdAt: string
  protocol: FieldPerformanceTestProtocol
  distanceM: number
  elapsedTimeSec: number
}

export interface AvailableRunningReference {
  status: 'available'
  source: {
    evaluationId: string
    protocol: FieldPerformanceTestProtocol
    performedAt: string
    distanceM: number
    elapsedTimeSec: number
  }
  derived: {
    paceSecPerKm: number
    paceLabel: string
    averageSpeedKmh: number
  }
}

export interface UnknownRunningReference {
  status: 'unknown'
}

export type RunningReference = AvailableRunningReference | UnknownRunningReference

export interface ResolveRunningReferenceInput {
  effectiveDate: string
  evidence: RunningReferenceEvidence[]
}

function compareEvidence(
  left: RunningReferenceEvidence,
  right: RunningReferenceEvidence,
): number {
  return (
    left.performedAt.localeCompare(right.performedAt) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.evaluationId.localeCompare(right.evaluationId)
  )
}

/**
 * Resolves the running reference applicable to an effective training date.
 *
 * The resolver is deliberately pure: canonical field-test evidence remains the
 * authority, while pace and speed are projected deterministically. A later
 * observation cannot alter an earlier effective-date resolution.
 */
export function resolveRunningReference({
  effectiveDate,
  evidence,
}: ResolveRunningReferenceInput): RunningReference {
  const applicable = evidence
    .filter((item) => item.performedAt <= effectiveDate)
    .sort(compareEvidence)
    .at(-1)

  if (!applicable) {
    return { status: 'unknown' }
  }

  const derived = deriveTrack1000mPerformance({
    protocol: applicable.protocol,
    distanceM: applicable.distanceM,
    elapsedTimeSec: applicable.elapsedTimeSec,
  })

  return {
    status: 'available',
    source: {
      evaluationId: applicable.evaluationId,
      protocol: applicable.protocol,
      performedAt: applicable.performedAt,
      distanceM: applicable.distanceM,
      elapsedTimeSec: applicable.elapsedTimeSec,
    },
    derived,
  }
}
