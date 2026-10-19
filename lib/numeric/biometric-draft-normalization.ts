import { parseRegionalNumericInput } from './regional-numeric-input'
import type { SelfDeclaredBiometricKind } from '@/lib/physiology/self-declared-biometric-validation'

/** Only normalize user-facing syntax. Physiological bounds, units and authorization remain downstream. */
export function normalizeBiometricDraftValue(
  raw: string,
  kind: SelfDeclaredBiometricKind,
): string | null {
  const parsed = parseRegionalNumericInput(raw, kind === 'weight' || kind === 'height'
    ? { kind: 'decimal', maxFractionDigits: 1 }
    : { kind: 'integer' })
  if (parsed.status !== 'valid') return null
  // Preserve entered fractional precision and emit the existing dot-only writer representation.
  return raw.replace(',', '.')
}
