import type {
  CompetitionDemandAssessment,
  CompetitionDemandBand,
  CourseProfile,
} from '@/types'

function validateCourseProfile(profile: CourseProfile) {
  if (!Number.isFinite(profile.distanceKm) || profile.distanceKm <= 0) {
    throw new Error('distanceKm must be finite and greater than zero.')
  }

  if (
    profile.elevationGainM !== null
    && (!Number.isFinite(profile.elevationGainM) || profile.elevationGainM < 0)
  ) {
    throw new Error('elevationGainM must be null or a finite non-negative value.')
  }

  if (
    profile.elevationLossM !== undefined
    && profile.elevationLossM !== null
    && (!Number.isFinite(profile.elevationLossM) || profile.elevationLossM < 0)
  ) {
    throw new Error('elevationLossM must be null or a finite non-negative value.')
  }
}

function resolveDemandBand(courseEffortKm: number): CompetitionDemandBand {
  if (courseEffortKm < 25) return 'very_low'
  if (courseEffortKm < 45) return 'low'
  if (courseEffortKm < 75) return 'moderate'
  if (courseEffortKm < 115) return 'high'
  if (courseEffortKm < 155) return 'very_high'
  return 'extreme'
}

/**
 * Assesses objective course demand from normalized course data.
 *
 * The baseline follows the trail-running km-effort convention:
 * `distanceKm + elevationGainM / 100`. When D+ is unknown the function avoids
 * inventing it and returns an unknown demand band instead of silently treating
 * the course as flat.
 */
export function assessCompetitionDemand(profile: CourseProfile): CompetitionDemandAssessment {
  validateCourseProfile(profile)

  const elevationGainKnown = profile.elevationGainM !== null
  const elevationLossKnown = profile.elevationLossM !== undefined && profile.elevationLossM !== null
  const altitudeProfileKnown = (
    profile.minAltitudeM !== undefined
    && profile.minAltitudeM !== null
    && profile.maxAltitudeM !== undefined
    && profile.maxAltitudeM !== null
  )
  const technicalityKnown = profile.technicality !== undefined && profile.technicality !== 'unknown'
  const limitations = {
    elevationGainKnown,
    elevationLossKnown,
    altitudeProfileKnown,
    technicalityKnown,
  }

  if (!elevationGainKnown) {
    return {
      courseEffortKm: null,
      band: 'unknown',
      confidence: 'low',
      profile,
      limitations,
    }
  }

  const courseEffortKm = profile.distanceKm + profile.elevationGainM / 100
  const enrichedSignals = [elevationLossKnown, altitudeProfileKnown, technicalityKnown]
    .filter(Boolean)
    .length

  return {
    courseEffortKm,
    band: resolveDemandBand(courseEffortKm),
    confidence: enrichedSignals === 3 ? 'high' : 'medium',
    profile,
    limitations,
  }
}
