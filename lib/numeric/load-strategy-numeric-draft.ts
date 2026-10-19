import { parseRegionalNumericInput } from './regional-numeric-input'
import type { LoadStrategyField } from '@/types'

export type LoadStrategyNumericDraftResult =
  | { readonly status: 'empty' }
  | { readonly status: 'editing' }
  | { readonly status: 'invalid' }
  | { readonly status: 'valid'; readonly value: number }

/**
 * Lexical parsing only. The existing load-strategy validator owns domain
 * ranges and cross-field relationships; no draft state is coerced to zero.
 */
export function parseLoadStrategyNumericDraft(
  raw: string,
  field: LoadStrategyField,
): LoadStrategyNumericDraftResult {
  const elevation = field === 'initialWeeklyElevationGain' || field === 'maximumWeeklyElevationGain'
  const parsed = parseRegionalNumericInput(raw, elevation
    ? { kind: 'integer' }
    : { kind: 'decimal', maxFractionDigits: 1 })

  if (parsed.status === 'valid') return { status: 'valid', value: parsed.value }
  return { status: parsed.status }
}
