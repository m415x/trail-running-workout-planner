/**
 * The only field-test protocol supported by Epic 4 v1.
 *
 * This identifier preserves a cheap future protocol seam without implying that
 * the observed result is a direct PAM/MAS, VO2max or threshold measurement.
 */
export type FieldPerformanceTestProtocol = '1000m_track'
export type FieldPerformanceTestSource = 'coach_manual' | 'athlete_manual' | 'legacy_migration'
export type FieldPerformanceTestExecutionContext = 'official' | 'self_directed'
export type FieldPerformanceTestRecordedBy = 'coach' | 'athlete'
export type FieldPerformanceTestReviewStatus = 'accepted' | 'pending_review' | 'rejected'

export interface Track1000mEvaluationInput {
  athleteId: string
  performedAt: string
  elapsedTimeSec: number
  notes?: string
  testEventId?: string
  executionContext?: FieldPerformanceTestExecutionContext
  recordedBy?: FieldPerformanceTestRecordedBy
  recordedByUserId?: string
}

export interface Track1000mEvaluation {
  athleteId: string
  performedAt: string
  protocol: FieldPerformanceTestProtocol
  source: FieldPerformanceTestSource
  distanceM: 1000
  elapsedTimeSec: number
  notes?: string
  testEventId: string | null
  executionContext: FieldPerformanceTestExecutionContext
  recordedBy: FieldPerformanceTestRecordedBy
  recordedByUserId: string | null
  reviewStatus: FieldPerformanceTestReviewStatus

}

export interface Track1000mObservation {
  protocol: FieldPerformanceTestProtocol
  distanceM: number
  elapsedTimeSec: number
}

export interface Track1000mPerformance {
  paceSecPerKm: number
  paceLabel: string
  averageSpeedKmh: number
}

function assertPositiveFiniteElapsedTime(elapsedTimeSec: number): void {
  if (!Number.isFinite(elapsedTimeSec) || elapsedTimeSec <= 0) {
    throw new Error('elapsedTimeSec must be a positive finite number')
  }
}

function assertIsoCalendarDate(performedAt: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(performedAt)
  if (!match) {
    throw new Error('performedAt must be a valid YYYY-MM-DD calendar date')
  }

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error('performedAt must be a valid YYYY-MM-DD calendar date')
  }
}

function formatPace(secondsPerKm: number): string {
  const wholeMinutes = Math.floor(secondsPerKm / 60)
  const remainingSeconds = secondsPerKm - wholeMinutes * 60
  const roundedSeconds = Math.round(remainingSeconds * 10) / 10

  if (roundedSeconds === 60) {
    return `${wholeMinutes + 1}:00/km`
  }

  const secondsLabel = Number.isInteger(roundedSeconds)
    ? String(roundedSeconds).padStart(2, '0')
    : roundedSeconds.toFixed(1).padStart(4, '0')

  return `${wholeMinutes}:${secondsLabel}/km`
}

/**
 * Creates the canonical observed evidence for the v1 1000 m track protocol.
 * Pace and speed are deliberately excluded because they are deterministic
 * derivations, not independent observed authority. The MVP provenance is
 * intentionally fixed to manual registration through the coach boundary.
 */
export function createTrack1000mEvaluation(
  input: Track1000mEvaluationInput,
): Track1000mEvaluation {
  if (!input.athleteId.trim()) {
    throw new Error('athleteId must not be empty')
  }

  assertIsoCalendarDate(input.performedAt)
  assertPositiveFiniteElapsedTime(input.elapsedTimeSec)

  const executionContext = input.executionContext ?? 'official'
  const recordedBy = input.recordedBy ?? 'coach'

  if (input.recordedByUserId !== undefined && !input.recordedByUserId.trim()) {
    throw new Error('recordedByUserId must not be empty')
  }

  if (executionContext === 'official' && !input.testEventId?.trim()) {
    // Legacy coach registrations predate explicit test events. Preserve that
    // boundary only when callers have not opted into the new lifecycle fields.
    if (
      input.executionContext !== undefined ||
      input.recordedBy !== undefined ||
      input.recordedByUserId !== undefined
    ) {
      throw new Error('testEventId is required for official evidence')
    }
  }

  if (executionContext === 'self_directed' && input.testEventId !== undefined) {
    throw new Error('self-directed evidence must not reference a testEventId')
  }

  const reviewStatus: FieldPerformanceTestReviewStatus =
    executionContext === 'self_directed' ? 'pending_review' : 'accepted'

  return {
    athleteId: input.athleteId,
    performedAt: input.performedAt,
    protocol: '1000m_track',
    source: recordedBy === 'athlete' ? 'athlete_manual' : 'coach_manual',
    distanceM: 1000,
    elapsedTimeSec: input.elapsedTimeSec,
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    testEventId: input.testEventId ?? null,
    executionContext,
    recordedBy,
    recordedByUserId: input.recordedByUserId ?? null,
    reviewStatus,
   }
}

/**
 * Resolves the review lifecycle of pending self-directed evidence without
 * changing its observed result, execution context, or recording provenance.
 * Accepted and rejected evidence are terminal in the v1 lifecycle.
 */
export function reviewTrack1000mEvaluation(
  evaluation: Track1000mEvaluation,
  reviewStatus: Exclude<FieldPerformanceTestReviewStatus, 'pending_review'>,
): Track1000mEvaluation {
  if (evaluation.reviewStatus !== 'pending_review') {
    throw new Error('only pending_review evidence can be reviewed')
  }

  return {
    ...evaluation,
    reviewStatus,
  }
}

/**
 * Reproduces presentation-oriented performance values from the observed 1000 m
 * evidence. These values make no physiological claim beyond arithmetic.
 */
export function deriveTrack1000mPerformance(
  observation: Track1000mObservation,
): Track1000mPerformance {
  if (observation.protocol !== '1000m_track') {
    throw new Error('protocol must be 1000m_track')
  }

  if (observation.distanceM !== 1000) {
    throw new Error('distanceM must be exactly 1000')
  }

  assertPositiveFiniteElapsedTime(observation.elapsedTimeSec)

  const paceSecPerKm = observation.elapsedTimeSec
  const averageSpeedKmh = Number((3600 / observation.elapsedTimeSec).toFixed(2))

  return {
    paceSecPerKm,
    paceLabel: formatPace(paceSecPerKm),
    averageSpeedKmh,
  }
}
