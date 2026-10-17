/** Pure input validation for self-declared biometrics; no persistence or authorization. */
export type SelfDeclaredBiometricKind = 'weight' | 'height' | 'max_hr' | 'rest_hr'

export interface BiometricValueInput {
  readonly kind: string
  readonly unit: string
  readonly value: string
}

export type BiometricValidationResult =
  | { readonly status: 'valid'; readonly valueScaled: number }
  | { readonly status: 'invalid' }

const specs: Record<SelfDeclaredBiometricKind, { unit: string; min: number; max: number; scale: number }> = {
  weight: { unit: 'kg', min: 200, max: 3500, scale: 10 },
  height: { unit: 'cm', min: 1000, max: 2500, scale: 10 },
  max_hr: { unit: 'bpm', min: 60, max: 240, scale: 1 },
  rest_hr: { unit: 'bpm', min: 25, max: 150, scale: 1 },
}

export function validateSelfDeclaredBiometric(input: BiometricValueInput): BiometricValidationResult {
  if (!Object.prototype.hasOwnProperty.call(specs, input.kind)) return { status: 'invalid' }
  const spec = specs[input.kind as SelfDeclaredBiometricKind]
  if (input.unit !== spec.unit) return { status: 'invalid' }
  const pattern = spec.scale === 10 ? /^(?:0|[1-9]\d*)(?:\.\d)?$/ : /^(?:0|[1-9]\d*)$/
  if (!pattern.test(input.value)) return { status: 'invalid' }
  const numeric = Number(input.value)
  const scaled = numeric * spec.scale
  if (!Number.isSafeInteger(scaled) || scaled < spec.min || scaled > spec.max) {
    return { status: 'invalid' }
  }
  return { status: 'valid', valueScaled: scaled }
}

/** Strict proleptic Gregorian civil date, independent of the host timezone. */
function civilDayNumber(value: string): number | null {
  if (!/^(?:\d{4})-(?:\d{2})-(?:\d{2})$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day || month > 12 || day > 31) return null
  const utc = new Date(0)
  utc.setUTCHours(0, 0, 0, 0)
  utc.setUTCFullYear(year, month - 1, day)
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null
  return Math.floor(utc.getTime() / 86400000)
}

export function validateSelfDeclaredObservedOn(input: {
  readonly observedOn: string
  /** Civil day resolved once on the server from the authorized regional context. */
  readonly today: string
}): boolean {
  const observed = civilDayNumber(input.observedOn)
  const today = civilDayNumber(input.today)
  if (observed === null || today === null) return false
  const difference = today - observed
  return difference >= 0 && difference <= 30
}

export interface SelfDeclaredHeartRateReading {
  readonly valueScaled: number
  readonly observedOn: string
  readonly source: string
  readonly isCurrentAtCutoff: boolean
}

export type HeartRatePairValidation = 'valid_pair' | 'invalid_pair' | 'not_comparable'

export function validateSelfDeclaredHeartRatePair(input: {
  readonly max: SelfDeclaredHeartRateReading | null
  readonly rest: SelfDeclaredHeartRateReading | null
}): HeartRatePairValidation {
  const { max, rest } = input
  if (!max || !rest) return 'not_comparable'
  if (max.source !== 'athlete_declared' || rest.source !== 'athlete_declared') return 'not_comparable'
  if (!max.isCurrentAtCutoff || !rest.isCurrentAtCutoff) return 'not_comparable'
  const maxDay = civilDayNumber(max.observedOn)
  const restDay = civilDayNumber(rest.observedOn)
  if (maxDay === null || restDay === null || Math.abs(maxDay - restDay) > 30) return 'not_comparable'
  if (!Number.isSafeInteger(max.valueScaled) || !Number.isSafeInteger(rest.valueScaled)) return 'invalid_pair'
  return rest.valueScaled < max.valueScaled ? 'valid_pair' : 'invalid_pair'
}
