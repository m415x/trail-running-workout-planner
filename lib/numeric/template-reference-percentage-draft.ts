import { parseRegionalNumericInput } from './regional-numeric-input'

export type TemplateReferencePercentageDraftResult =
  | { readonly status: 'empty' }
  | { readonly status: 'invalid' }
  | { readonly status: 'valid'; readonly value: string }

/** Lexical normalization only; range and requiredness remain domain concerns. */
export function normalizeTemplateReferencePercentageDraft(
  raw: string,
): TemplateReferencePercentageDraftResult {
  const parsed = parseRegionalNumericInput(raw, {
    kind: 'decimal',
    maxFractionDigits: 1,
  })

  if (parsed.status === 'empty') return { status: 'empty' }
  if (parsed.status !== 'valid') return { status: 'invalid' }

  return { status: 'valid', value: raw.replace(',', '.') }
}
