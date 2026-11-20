import {
  calculateVerticalBlockTotals,
  type VerticalBlockV1,
} from './vertical-prescription'

export type VerticalBlockJsonReadResult =
  | { status: 'absent' }
  | { status: 'valid'; block: VerticalBlockV1 }
  | { status: 'unsupported'; schemaVersion: number }
  | { status: 'corrupt' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const ownKeys = Object.keys(value)
  return ownKeys.length === keys.length && ownKeys.every((key) => keys.includes(key))
}

function isValidProvenance(value: unknown): boolean {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return false
  }

  if (value.kind === 'track_adopted') {
    return hasExactKeys(value, ['kind', 'trackReference'])
      && typeof value.trackReference === 'string'
      && value.trackReference.trim().length > 0
  }

  return (value.kind === 'coach_manual' || value.kind === 'unknown')
    && hasExactKeys(value, ['kind'])
}

function isValidMetricShape(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ['meters', 'provenance'])
    && (value.meters === null || typeof value.meters === 'number')
    && isValidProvenance(value.provenance)
}

function isValidV1Shape(value: Record<string, unknown>): boolean {
  return hasExactKeys(value, [
    'schemaVersion',
    'direction',
    'repetitions',
    'coverage',
    'elevationGainPerRep',
    'elevationLossPerRep',
  ])
    && isValidMetricShape(value.elevationGainPerRep)
    && isValidMetricShape(value.elevationLossPerRep)
}

/**
 * Read-only classification of an optional vertical prescription JSON record.
 * Never coerce malformed or future-version records into absent v1 data.
 *
 * Strict v1 shape is enforced here; the 4096-byte write boundary is a separate T2 cut.
 */
export function readVerticalBlockJson(raw: string | null): VerticalBlockJsonReadResult {
  if (raw === null) {
    return { status: 'absent' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { status: 'corrupt' }
  }

  if (!isRecord(parsed)) {
    return { status: 'corrupt' }
  }

  if (
    typeof parsed.schemaVersion === 'number'
    && Number.isSafeInteger(parsed.schemaVersion)
    && parsed.schemaVersion > 1
  ) {
    return { status: 'unsupported', schemaVersion: parsed.schemaVersion }
  }

  if (parsed.schemaVersion !== 1) {
    return { status: 'corrupt' }
  }

  if (!isValidV1Shape(parsed)) {
    return { status: 'corrupt' }
  }

  try {
    calculateVerticalBlockTotals(parsed as unknown as VerticalBlockV1)
    return { status: 'valid', block: parsed as unknown as VerticalBlockV1 }
  } catch {
    return { status: 'corrupt' }
  }
}
