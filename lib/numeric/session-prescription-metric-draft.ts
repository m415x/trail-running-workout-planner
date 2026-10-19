import { parseRegionalNumericInput } from './regional-numeric-input'

export type SessionPrescriptionMetricKind = 'distanceKm' | 'durationMin' | 'elevationGain'

export type SessionPrescriptionMetricDraftResult =
  | { readonly status: 'empty' }
  | { readonly status: 'invalid' }
  | { readonly status: 'valid'; readonly value: string }

/** Lexical normalization only; domain ranges remain in the authorized session action. */
export function normalizeSessionPrescriptionMetricDraft(
  raw: string,
  kind: SessionPrescriptionMetricKind,
): SessionPrescriptionMetricDraftResult {
  const parsed = parseRegionalNumericInput(
    raw,
    kind === 'distanceKm'
      ? { kind: 'decimal', maxFractionDigits: 1 }
      : { kind: 'integer' },
  )
  if (parsed.status === 'empty') return { status: 'empty' }
  if (parsed.status !== 'valid') return { status: 'invalid' }
  return { status: 'valid', value: raw.replace(',', '.') }
}
