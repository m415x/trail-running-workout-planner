import { parseRegionalNumericInput } from './regional-numeric-input'

export type MicrocyclePlanningDraftKind = 'volumeKm' | 'elevationGainM'

export type MicrocyclePlanningDraftResult =
  | { readonly status: 'empty' }
  | { readonly status: 'invalid' }
  | { readonly status: 'valid'; readonly value: string }

/**
 * Canonical lexical representation for existing planning form contracts.
 * Does not perform range validation, rounding, or authorization.
 */
export function normalizeMicrocyclePlanningDraft(
  raw: string,
  kind: MicrocyclePlanningDraftKind,
): MicrocyclePlanningDraftResult {
  const parsed = parseRegionalNumericInput(raw, kind === 'volumeKm'
    ? { kind: 'decimal', maxFractionDigits: 1 }
    : { kind: 'integer' })

  if (parsed.status === 'empty') return kind === 'elevationGainM'
    ? { status: 'empty' }
    : { status: 'invalid' }
  if (parsed.status !== 'valid') return { status: 'invalid' }

  return { status: 'valid', value: raw.replace(',', '.') }
}
