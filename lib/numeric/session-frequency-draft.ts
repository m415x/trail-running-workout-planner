import { parseRegionalNumericInput } from './regional-numeric-input'

export type FixedSessionFrequencyDraftResult =
  | { readonly status: 'empty' }
  | { readonly status: 'invalid' }
  | { readonly status: 'valid'; readonly value: string }

/** Preserve empty as automatic mode and enforce integer syntax only.
 * Domain range (3–5 sessions) remains with the existing frequency validator.
 */
export function normalizeFixedSessionFrequencyDraft(raw: string): FixedSessionFrequencyDraftResult {
  const parsed = parseRegionalNumericInput(raw, { kind: 'integer' })
  if (parsed.status === 'empty') return { status: 'empty' }
  if (parsed.status !== 'valid') return { status: 'invalid' }
  return { status: 'valid', value: raw }
}
