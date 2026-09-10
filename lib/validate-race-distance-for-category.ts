import type { AthleteCategoryCode } from '@/types/athlete/group.types'
import type {
  CategoryRaceDistancePolicyOptions,
  CategoryRaceDistanceResult,
} from '@/types/athlete/category-race-distance.types'
import {
  CATEGORY_RACE_DISTANCE_POLICY,
  DEFAULT_CATEGORY_RACE_DISTANCE_POLICY_OPTIONS,
} from '@/lib/category-race-distance-policy'

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

// Absorb floating-point arithmetic noise, not an additional distance tolerance.
function sameEndpoint(a: number, b: number): boolean {
  return Math.abs(a - b) <= Number.EPSILON * Math.max(Math.abs(a), Math.abs(b)) * 4
}

/**
 * Evaluate competitive distance (km) against a category's advisory policy.
 * Validates category, options, and supplied distance before policy evaluation.
 * Null/undefined distance means absent competitive context; strings are not
 * coerced. Forms remain responsible for requiring race data when appropriate.
 * A mismatch is non-blocking; E is unrestricted and B explicitly pending.
 * Applies outward tolerance once to inclusive bounds, preserving base values.
 * Never mutates inputs, plans, athlete groups, or the shared policy catalog.
 */
export function validateRaceDistanceForCategory(
  category: unknown,
  distanceKm: unknown,
  options: CategoryRaceDistancePolicyOptions = DEFAULT_CATEGORY_RACE_DISTANCE_POLICY_OPTIONS,
): CategoryRaceDistanceResult {
  if (typeof category !== 'string' || !Object.hasOwn(CATEGORY_RACE_DISTANCE_POLICY, category)) {
    return { status: 'invalid', blocking: true, reason: 'category' }
  }
  const tolerance = options?.tolerancePercent
  if (typeof tolerance !== 'number' || !Number.isFinite(tolerance) || tolerance < 0 || tolerance >= 100) {
    return { status: 'invalid', blocking: true, reason: 'tolerance' }
  }
  if (distanceKm === null || distanceKm === undefined) {
    return { status: 'not_applicable', blocking: false }
  }
  if (!isPositiveFinite(distanceKm)) {
    return { status: 'invalid', blocking: true, reason: 'distance' }
  }
  const policy = CATEGORY_RACE_DISTANCE_POLICY[category as AthleteCategoryCode]
  if (policy.kind === 'unrestricted') return { status: 'unrestricted', blocking: false }
  if (policy.kind === 'pending') return { status: 'policy_not_defined', blocking: false }

  const { minKm, maxKm } = policy
  if (
    (minKm !== null && !isPositiveFinite(minKm)) ||
    (maxKm !== null && !isPositiveFinite(maxKm)) ||
    (minKm === null && maxKm === null) ||
    (minKm !== null && maxKm !== null && minKm > maxKm)
  ) return { status: 'invalid', blocking: true, reason: 'policy' }

  const effectiveMinKm = minKm === null ? null : minKm * (1 - tolerance / 100)
  const effectiveMaxKm = maxKm === null ? null : maxKm * (1 + tolerance / 100)
  if (
    (effectiveMinKm !== null && !isPositiveFinite(effectiveMinKm)) ||
    (effectiveMaxKm !== null && !isPositiveFinite(effectiveMaxKm))
  ) return { status: 'invalid', blocking: true, reason: 'policy' }

  const below = effectiveMinKm !== null && distanceKm < effectiveMinKm && !sameEndpoint(distanceKm, effectiveMinKm)
  const above = effectiveMaxKm !== null && distanceKm > effectiveMaxKm && !sameEndpoint(distanceKm, effectiveMaxKm)
  return {
    status: below || above ? 'incompatible' : 'compatible',
    blocking: false,
    direction: below ? 'below_minimum' : above ? 'above_maximum' : null,
    minKm, maxKm, effectiveMinKm, effectiveMaxKm,
    tolerancePercent: tolerance,
  }
}
