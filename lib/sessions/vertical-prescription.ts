/**
 * Pure vertical-session block calculation.
 *
 * Session-wide elevation and persistence are owned by later KAN-593 cuts.
 * Neither the direction nor a known D+ value implies a D- or distance.
 */
export type VerticalDirection = 'ascent' | 'descent' | 'circuit'
export type VerticalCoverage = 'complete' | 'partial'

export type VerticalMetricProvenance =
  | { kind: 'coach_manual' }
  | { kind: 'track_adopted'; trackReference: string }
  | { kind: 'unknown' }

export interface VerticalMetricPerRepetition {
  meters: number | null
  provenance: VerticalMetricProvenance
}

export interface VerticalBlockV1 {
  schemaVersion: 1
  direction: VerticalDirection
  repetitions: number
  coverage: VerticalCoverage
  elevationGainPerRep: VerticalMetricPerRepetition
  elevationLossPerRep: VerticalMetricPerRepetition
}

export interface VerticalBlockTotals {
  elevationGainTotalM: number | null
  elevationLossTotalM: number | null
}

/** Positive range shared by SQLite/PG integer elevation columns. */
const MAX_PERSISTABLE_ELEVATION_M = 2_147_483_647

function totalForMetric(metric: VerticalMetricPerRepetition, repetitions: number): number | null {
  const provenance = metric.provenance
  if (metric.meters === null) {
    if (provenance?.kind !== 'unknown') {
      throw new RangeError('Unknown vertical elevation requires unknown provenance')
    }
    return null
  }

  if (
    provenance?.kind !== 'coach_manual'
    && provenance?.kind !== 'track_adopted'
  ) {
    throw new RangeError('Known vertical elevation requires confirmed provenance')
  }

  if (
    provenance.kind === 'track_adopted'
    && (typeof provenance.trackReference !== 'string' || !provenance.trackReference.trim())
  ) {
    throw new RangeError('Adopted vertical track requires a non-blank reference')
  }

  const total = metric.meters * repetitions
  if (
    !Number.isSafeInteger(metric.meters)
    || metric.meters < 0
    || !Number.isSafeInteger(total)
    || total > MAX_PERSISTABLE_ELEVATION_M
  ) {
    throw new RangeError('Vertical elevation is outside the supported integer range')
  }

  return total
}
/**
 * Derives only explicitly quantified metrics from one homogeneous block.
 * Unknown remains unknown; coverage does not change the block subtotal.
 */
export function calculateVerticalBlockTotals(block: VerticalBlockV1): VerticalBlockTotals {
  if (block.direction !== 'ascent' && block.direction !== 'descent' && block.direction !== 'circuit') {
    throw new RangeError('Unsupported vertical repetition direction')
  }

  if (!Number.isSafeInteger(block.repetitions) || block.repetitions <= 0) {
    throw new RangeError('Vertical repetitions must be a positive safe integer')
  }

  return {
    elevationGainTotalM: totalForMetric(block.elevationGainPerRep, block.repetitions),
    elevationLossTotalM: totalForMetric(block.elevationLossPerRep, block.repetitions),
  }
}

/**
 * Reconciles the prescribed D+ for the whole session with the vertical block.
 * A complete block is the entire quantified D+ dose, never an extra amount.
 * A partial block contributes a subtotal already included in the whole-session D+.
 */
export function resolveVerticalSessionElevationGain(input: {
  block: VerticalBlockV1
  proposedSessionElevationGainM: number | null
}): number | null {
  const { block, proposedSessionElevationGainM } = input
  const { elevationGainTotalM } = calculateVerticalBlockTotals(block)

  if (
    proposedSessionElevationGainM !== null
    && (
      !Number.isSafeInteger(proposedSessionElevationGainM)
      || proposedSessionElevationGainM < 0
      || proposedSessionElevationGainM > MAX_PERSISTABLE_ELEVATION_M
    )
  ) {
    throw new RangeError('Whole-session elevation must be a persistable non-negative integer or null')
  }

  if (block.coverage === 'complete') {
    if (proposedSessionElevationGainM !== elevationGainTotalM) {
      throw new RangeError('Complete vertical block must equal whole-session elevation gain')
    }
    return elevationGainTotalM
  }

  if (
    block.coverage === 'partial'
    && elevationGainTotalM !== null
    && proposedSessionElevationGainM !== null
    && proposedSessionElevationGainM < elevationGainTotalM
  ) {
    throw new RangeError('Whole-session elevation cannot be below the known vertical subtotal')
  }

  return proposedSessionElevationGainM
}

/** Explicit main workout objective. A missing legacy objective stays unknown. */
export type VerticalPrimaryObjective = 'distance' | 'elevation_gain' | 'duration'

/**
 * Resolves the chosen objective without deriving one from an optional vertical
 * block, the elevation subtotal, or any other session measurement.
 */
export function resolveVerticalPrimaryObjective(input: {
  primaryObjective?: VerticalPrimaryObjective | null
  verticalBlockPresent?: boolean
  elevationGainM?: number | null
}): VerticalPrimaryObjective | null {
  const objective = input.primaryObjective
  if (objective === undefined || objective === null) {
    return null
  }

  if (objective === 'distance' || objective === 'elevation_gain' || objective === 'duration') {
    return objective
  }

  throw new RangeError('Unsupported vertical session primary objective')
}
