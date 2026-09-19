/**
 * The only field-test protocol supported by Epic 4 v1.
 *
 * This identifier preserves a cheap future protocol seam without implying that
 * the observed result is a direct PAM/MAS, VO2max or threshold measurement.
 */
export type FieldPerformanceTestProtocol = '1000m_track'
export type FieldPerformanceTestSource = 'coach_manual' | 'legacy_migration'

export interface Track1000mEvaluationInput {
  athleteId: string
  performedAt: string
  elapsedTimeSec: number
  notes?: string
}

export interface Track1000mEvaluation {
  athleteId: string
  performedAt: string
  protocol: FieldPerformanceTestProtocol
  source: FieldPerformanceTestSource
  distanceM: 1000
  elapsedTimeSec: number
  notes?: string
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

  return {
    athleteId: input.athleteId,
    performedAt: input.performedAt,
    protocol: '1000m_track',
    source: 'coach_manual',
    distanceM: 1000,
    elapsedTimeSec: input.elapsedTimeSec,
    ...(input.notes === undefined ? {} : { notes: input.notes }),
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
