import type { MicrocycleLoadFocus, MicrocycleType } from '@/types'

/**
 * Assigns the primary training focus represented by a microcycle type.
 *
 * Focus is metadata, not a combined-load formula. Kilometer and elevation
 * targets remain independent, while later session generation can use this
 * distinction to emphasize distance or vertical terrain.
 */
export function determineMicrocycleLoadFocus(
  type: MicrocycleType,
): MicrocycleLoadFocus {
  switch (type) {
    case 'base':
      return 'balanced'
    case 'development':
      return 'volume'
    case 'shock':
      return 'elevation'
    case 'deload':
    case 'tapering':
      return 'recovery'
    case 'race':
      return 'race_specific'
  }
}
