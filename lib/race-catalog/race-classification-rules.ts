import { calculateKilometerEffortKm } from '@/lib/race-catalog/race-course-derived-profile'
import type { RaceCourseClassificationRule } from '@/lib/race-catalog/race-course-coherence'

/**
 * ITRA endurance/difficulty points as documented in the primary sources
 * consulted on 2026-09-13. The dated versionRef prevents this living external
 * taxonomy from being treated as timeless product logic.
 */
export const ITRA_ENDURANCE_POINTS_2026_09_13: RaceCourseClassificationRule = {
  systemId: 'itra.endurance_points',
  dimension: 'endurance_difficulty',
  versionRef: 'current-2026-09-13',
  resolveCode: ({ distanceKm, elevationGainM }) => {
    if (distanceKm === null) return null
    const kilometerEffortKm = calculateKilometerEffortKm(distanceKm, elevationGainM)
    if (kilometerEffortKm === null) return null

    if (kilometerEffortKm < 25) return '0'
    if (kilometerEffortKm < 45) return '1'
    if (kilometerEffortKm < 75) return '2'
    if (kilometerEffortKm < 115) return '3'
    if (kilometerEffortKm < 155) return '4'
    if (kilometerEffortKm < 210) return '5'
    return '6'
  },
}
