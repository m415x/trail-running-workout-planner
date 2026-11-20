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
 * Strict v1 shape is enforced here. Writes must additionally enforce the UTF-8 size limit.
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

/**
 * Serializes only an explicitly valid v1 block, preserving SQL NULL for absence.
 * The byte limit is enforced before any caller can persist the resulting JSON.
 */
export function writeVerticalBlockJson(block: VerticalBlockV1 | null): string | null {
  if (block === null) {
    return null
  }

  let serialized: string
  try {
    serialized = JSON.stringify(block)
  } catch {
    throw new RangeError('Vertical block must be serializable JSON')
  }

  if (typeof serialized !== 'string') {
    throw new RangeError('Vertical block must be serializable JSON')
  }

  if (new TextEncoder().encode(serialized).byteLength > 4096) {
    throw new RangeError('Vertical block JSON exceeds the 4096-byte UTF-8 limit')
  }

  if (readVerticalBlockJson(serialized).status !== 'valid') {
    throw new RangeError('Vertical block must match the supported v1 schema')
  }

  return serialized
}
