/**
 * Inclusive competitive-distance bounds in kilometers, before tolerance.
 * Null means an intentionally absent bound; at least one bound is required.
 * Numeric bounds must be finite and positive, with minKm <= maxKm when both
 * exist. Runtime validation belongs to the policy evaluator.
 */
export type CategoryRaceDistanceBounds =
  | { readonly minKm: number; readonly maxKm: number | null }
  | { readonly minKm: null; readonly maxKm: number }

/**
 * Advisory race-distance policy, independent of weekly load and athlete level.
 * Unrestricted is deliberate (Elite); pending means the rule is unknown (Base).
 * Neither state asserts individual race readiness. Bounds are only available
 * after narrowing to bounded, preventing null bounds from conflating E and B.
 */
export type CategoryRaceDistancePolicy =
  | ({ readonly kind: 'bounded' } & CategoryRaceDistanceBounds)
  | { readonly kind: 'unrestricted' }
  | { readonly kind: 'pending' }

/**
 * Configuration for advisory distance evaluation, without persistence or UI.
 * tolerancePercent uses percentage points (10 means 10%), finite in [0, 100).
 * Expand each existing bound outward once; effective endpoints stay inclusive.
 * This does not change the visible base range or round the race distance.
 */
export interface CategoryRaceDistancePolicyOptions {
  readonly tolerancePercent: number
}

/** Pure evaluation outcome; only invalid data/configuration blocks continuation. */
export type CategoryRaceDistanceResult =
  | {
      readonly status: 'invalid'
      readonly blocking: true
      readonly reason: 'category' | 'distance' | 'tolerance' | 'policy'
    }
  | {
      readonly status: 'not_applicable' | 'unrestricted' | 'policy_not_defined'
      readonly blocking: false
    }
  | {
      readonly status: 'compatible' | 'incompatible'
      readonly blocking: false
      /** Direction outside the effective range; null when compatible. */
      readonly direction: 'below_minimum' | 'above_maximum' | null
      /** Original competitive bounds, in km, retained for display. */
      readonly minKm: number | null
      readonly maxKm: number | null
      /** Inclusive alert thresholds, in km, without rounding race distance. */
      readonly effectiveMinKm: number | null
      readonly effectiveMaxKm: number | null
      readonly tolerancePercent: number
    }
