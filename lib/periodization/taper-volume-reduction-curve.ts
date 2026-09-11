import { getCompetitionAdjustmentPolicy } from '@/lib/periodization/competition-adjustment-policy'

import type {
  PreCompetitionLoadContext,
  TaperDurationDecision,
  TaperVolumeReductionCurve,
} from '@/types'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100
}

function interpolate(min: number, max: number, position: number) {
  return min + ((max - min) * clamp(position, 0, 1))
}

function durationPosition(decision: TaperDurationDecision) {
  const { min, max } = decision.policyLimitsDays

  if (max <= min) return decision.durationDays > 0 ? 1 : 0

  return clamp((decision.durationDays - min) / (max - min), 0, 1)
}

/**
 * Builds a monotonic pre-competition volume-reduction curve in calendar days.
 *
 * The reached recent average volume is the reference load. Priority policy
 * constrains the final reduction magnitude, while the taper-duration decision
 * positions the proposal within that range. H10 v1 uses a transparent linear
 * progression across taper days; the shape is deliberately isolated here so a
 * future evidence-backed curve can replace it without changing callers.
 *
 * The returned targets are weekly-equivalent planning values. They must not be
 * interpreted as daily running distance, and competition distance is excluded.
 */
export function calculateTaperVolumeReductionCurve(
  decision: TaperDurationDecision,
  load: PreCompetitionLoadContext,
): TaperVolumeReductionCurve {
  const referenceVolumeKm = load.volume.recentAverageKm

  if (!Number.isFinite(referenceVolumeKm) || referenceVolumeKm < 0) {
    throw new Error('Pre-competition reference volume must be finite and non-negative.')
  }

  if (!Number.isInteger(decision.durationDays) || decision.durationDays < 0) {
    throw new Error('Taper duration must be a non-negative integer number of days.')
  }

  const policy = getCompetitionAdjustmentPolicy(decision.priority)

  if (decision.durationDays === 0) {
    return {
      priority: decision.priority,
      durationDays: 0,
      referenceVolumeKm,
      finalReductionPercentage: 0,
      points: [],
    }
  }

  const finalReductionPercentage = roundToTwoDecimals(interpolate(
    policy.volumeReductionPercentage.min,
    policy.volumeReductionPercentage.max,
    durationPosition(decision),
  ))

  const points = Array.from({ length: decision.durationDays }, (_, index) => {
    const dayNumber = index + 1
    const progress = dayNumber / decision.durationDays
    const reductionPercentage = roundToTwoDecimals(finalReductionPercentage * progress)
    const remainingVolumePercentage = roundToTwoDecimals(100 - reductionPercentage)
    const targetWeeklyEquivalentVolumeKm = roundToTwoDecimals(
      referenceVolumeKm * (remainingVolumePercentage / 100),
    )

    return {
      dayNumber,
      daysBeforeCompetition: decision.durationDays - index,
      reductionPercentage,
      remainingVolumePercentage,
      targetWeeklyEquivalentVolumeKm,
    }
  })

  return {
    priority: decision.priority,
    durationDays: decision.durationDays,
    referenceVolumeKm,
    finalReductionPercentage,
    points,
  }
}
