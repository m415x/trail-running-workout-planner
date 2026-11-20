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

/**
 * Read-only classification of an optional vertical prescription JSON record.
 * Never coerce malformed or future-version records into absent v1 data.
 *
 * Strict key allowlisting and the 4096-byte write boundary are separate T2 cuts.
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

  try {
    calculateVerticalBlockTotals(parsed as unknown as VerticalBlockV1)
    return { status: 'valid', block: parsed as unknown as VerticalBlockV1 }
  } catch {
    return { status: 'corrupt' }
  }
}
