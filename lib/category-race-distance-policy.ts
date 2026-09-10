import type { AthleteCategoryCode } from '@/types/athlete/group.types'
import type {
  CategoryRaceDistancePolicy,
  CategoryRaceDistancePolicyOptions,
} from '@/types/athlete/category-race-distance.types'

/**
 * Initial advisory race-distance ranges in km, approved in H8/T1.
 * All numeric endpoints are inclusive and shared endpoints are intentional.
 * These values complement ATHLETE_CATEGORIES; they do not describe weekly
 * volume or prescribe reassignment. E is unrestricted and B remains pending.
 * Frozen records protect the shared policy from accidental runtime mutation.
 */
export const CATEGORY_RACE_DISTANCE_POLICY = Object.freeze({
  E: Object.freeze({ kind: 'unrestricted' } as const),
  U: Object.freeze({ kind: 'bounded', minKm: 42, maxKm: null } as const),
  M: Object.freeze({ kind: 'bounded', minKm: 21, maxKm: 42 } as const),
  H: Object.freeze({ kind: 'bounded', minKm: 15, maxKm: 21 } as const),
  S: Object.freeze({ kind: 'bounded', minKm: 5, maxKm: 15 } as const),
  B: Object.freeze({ kind: 'pending' } as const),
} satisfies Record<AthleteCategoryCode, CategoryRaceDistancePolicy>)

/**
 * Default outward alert tolerance in percentage points; callers may supply
 * their own options without mutating this default. Evaluating compatibility
 * and enforcing numeric configuration constraints belong to H8/T3.
 */
export const DEFAULT_CATEGORY_RACE_DISTANCE_POLICY_OPTIONS = Object.freeze({
  tolerancePercent: 10,
} satisfies CategoryRaceDistancePolicyOptions)
