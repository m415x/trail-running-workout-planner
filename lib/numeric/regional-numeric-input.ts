export type RegionalNumericOptions =
  | { readonly kind: 'integer' }
  | { readonly kind: 'decimal'; readonly maxFractionDigits: number }

export type RegionalNumericResult =
  | { readonly status: 'empty' }
  | { readonly status: 'editing' }
  | { readonly status: 'invalid' }
  | { readonly status: 'valid'; readonly value: number }

/**
 * Parse a UI numeric representation without changing domain constraints.
 * No thousands separators, exponent notation, partial parsing or rounding.
 * Consumers remain responsible for min/max, units and optionality.
 */
export function parseRegionalNumericInput(
  raw: string,
  options: RegionalNumericOptions,
): RegionalNumericResult {
  if (raw === '') return { status: 'empty' }
  if (raw === '-' || raw === '+' || (
    options.kind === 'decimal' &&
    /^[-+]?(?:[.,]|\d+[.,])$/.test(raw)
  )) return { status: 'editing' }

  if (options.kind === 'decimal') {
    if (!Number.isInteger(options.maxFractionDigits) || options.maxFractionDigits < 0) {
      return { status: 'invalid' }
    }

    const match = /^([+-]?\d+)(?:([.,])(\d+))?$/.exec(raw)
    if (!match) return { status: 'invalid' }
    const fraction = match[3] ?? ''
    if (fraction.length > options.maxFractionDigits) return { status: 'invalid' }
    const normalized = match[1] + (match[2] ? '.' + fraction : '')
    const value = Number(normalized)
    return Number.isFinite(value) ? { status: 'valid', value } : { status: 'invalid' }
  }

  if (!/^[+-]?\d+$/.test(raw)) return { status: 'invalid' }
  const value = Number(raw)
  return Number.isSafeInteger(value) ? { status: 'valid', value } : { status: 'invalid' }
}
