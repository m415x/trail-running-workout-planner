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
  if (metric.meters === null) {
    return null
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
