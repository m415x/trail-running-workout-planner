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
