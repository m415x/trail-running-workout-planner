import type {
  CompetitionDemandAssessment,
  PreCompetitionLoadContext,
  TaperDurationDecision,
  TaperElevationReductionCurve,
  TaperElevationSpecificity,
} from '@/types'

const MEANINGFUL_VERTICAL_DENSITY_M_PER_KM = 20
const HIGH_VERTICAL_DENSITY_M_PER_KM = 50

/**
 * H10 v1 policy guardrails for preserving climbing specificity.
 *
 * These are product/domain policy values, not claimed physiological thresholds.
 * They are centralized here so later evidence or coach configuration can replace
 * them without changing the reconciliation contract.
 */
const SPECIFICITY_POLICY: Record<Exclude<TaperElevationSpecificity, 'unknown'>, {
  finalReductionMultiplier: number
  specificityFloorPercentage: number
}> = {
  flat_or_minimal: {
    finalReductionMultiplier: 1.15,
    specificityFloorPercentage: 0,
  },
  meaningful_vertical: {
    finalReductionMultiplier: 1,
    specificityFloorPercentage: 25,
  },
  high_vertical: {
    finalReductionMultiplier: 0.85,
    specificityFloorPercentage: 35,
  },
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100
}

function getCourseVerticalDensity(demand: CompetitionDemandAssessment) {
  const { distanceKm, elevationGainM } = demand.profile

  if (
    !Number.isFinite(distanceKm)
    || distanceKm <= 0
    || elevationGainM === null
    || !Number.isFinite(elevationGainM)
    || elevationGainM < 0
  ) {
    return null
  }

  return elevationGainM / distanceKm
}

function classifySpecificity(verticalDensityMPerKm: number | null): TaperElevationSpecificity {
  if (verticalDensityMPerKm === null) return 'unknown'
  if (verticalDensityMPerKm < MEANINGFUL_VERTICAL_DENSITY_M_PER_KM) return 'flat_or_minimal'
  if (verticalDensityMPerKm < HIGH_VERTICAL_DENSITY_M_PER_KM) return 'meaningful_vertical'
  return 'high_vertical'
}

/**
 * Builds the D+ taper curve independently from the volume curve.
 *
 * The volume curve supplies the overall unloading magnitude, while course
 * vertical density decides how much climbing specificity should be retained.
 * High-D+ courses therefore reduce vertical exposure less aggressively than
 * flat courses, without keeping the full reached D+ load.
 *
 * Exact D+ preservation percentages are H10 v1 domain policy rather than a
 * claim of universal physiological thresholds. Future course profiles may add
 * D-, gradients and technicality without changing this contract.
 */
export function calculateTaperElevationReductionCurve(
  decision: TaperDurationDecision,
  load: PreCompetitionLoadContext,
  demand: CompetitionDemandAssessment,
  finalVolumeReductionPercentage: number,
): TaperElevationReductionCurve {
  const referenceElevationGainM = load.elevation.recentAverageGainM
  const courseVerticalDensityMPerKm = getCourseVerticalDensity(demand)
  const specificity = classifySpecificity(courseVerticalDensityMPerKm)

  if (!Number.isFinite(finalVolumeReductionPercentage) || finalVolumeReductionPercentage < 0 || finalVolumeReductionPercentage > 100) {
    throw new Error('Final volume reduction must be a finite percentage between 0 and 100.')
  }

  if (!Number.isInteger(decision.durationDays) || decision.durationDays < 0) {
    throw new Error('Taper duration must be a non-negative integer number of days.')
  }

  if (referenceElevationGainM !== null && (!Number.isFinite(referenceElevationGainM) || referenceElevationGainM < 0)) {
    throw new Error('Pre-competition reference elevation gain must be finite and non-negative when known.')
  }

  if (decision.durationDays === 0 || referenceElevationGainM === null) {
    return {
      priority: decision.priority,
      durationDays: decision.durationDays,
      referenceElevationGainM,
      courseVerticalDensityMPerKm: courseVerticalDensityMPerKm === null
        ? null
        : roundToTwoDecimals(courseVerticalDensityMPerKm),
      specificity,
      finalReductionPercentage: decision.durationDays === 0 ? 0 : null,
      specificityFloorPercentage: specificity === 'unknown'
        ? null
        : SPECIFICITY_POLICY[specificity].specificityFloorPercentage,
      requiresCoachReview: referenceElevationGainM === null || specificity === 'unknown',
      points: [],
    }
  }

  const effectiveSpecificity = specificity === 'unknown' ? 'meaningful_vertical' : specificity
  const policy = SPECIFICITY_POLICY[effectiveSpecificity]
  const maximumReductionFromFloor = 100 - policy.specificityFloorPercentage
  const finalReductionPercentage = roundToTwoDecimals(clamp(
    finalVolumeReductionPercentage * policy.finalReductionMultiplier,
    0,
    maximumReductionFromFloor,
  ))

  const points = Array.from({ length: decision.durationDays }, (_, index) => {
    const dayNumber = index + 1
    const progress = dayNumber / decision.durationDays
    const reductionPercentage = roundToTwoDecimals(finalReductionPercentage * progress)
    const remainingElevationPercentage = roundToTwoDecimals(100 - reductionPercentage)
    const targetWeeklyEquivalentElevationGainM = roundToTwoDecimals(
      referenceElevationGainM * (remainingElevationPercentage / 100),
    )

    return {
      dayNumber,
      daysBeforeCompetition: decision.durationDays - index,
      reductionPercentage,
      remainingElevationPercentage,
      targetWeeklyEquivalentElevationGainM,
    }
  })

  return {
    priority: decision.priority,
    durationDays: decision.durationDays,
    referenceElevationGainM,
    courseVerticalDensityMPerKm: courseVerticalDensityMPerKm === null
      ? null
      : roundToTwoDecimals(courseVerticalDensityMPerKm),
    specificity,
    finalReductionPercentage,
    specificityFloorPercentage: policy.specificityFloorPercentage,
    requiresCoachReview: specificity === 'unknown',
    points,
  }
}
