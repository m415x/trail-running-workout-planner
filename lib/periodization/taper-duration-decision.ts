import { getCompetitionAdjustmentPolicy } from '@/lib/periodization/competition-adjustment-policy'

import type {
  CompetitionDemandAssessment,
  CompetitionDemandBand,
  CompetitionPriority,
  NumericRange,
  PreCompetitionLoadContext,
  PreCompetitionLoadTrend,
  TaperDurationDecision,
} from '@/types'

const DEMAND_POSITION_RANGES: Record<CompetitionDemandBand, NumericRange> = {
  unknown: { min: 0.3, max: 0.7 },
  very_low: { min: 0, max: 0.25 },
  low: { min: 0.15, max: 0.4 },
  moderate: { min: 0.3, max: 0.6 },
  high: { min: 0.5, max: 0.75 },
  very_high: { min: 0.65, max: 0.9 },
  extreme: { min: 0.8, max: 1 },
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function trendPosition(trend: PreCompetitionLoadTrend | null) {
  if (trend === 'rising') return 1
  if (trend === 'falling') return 0
  return 0.5
}

function sustainedLoadRatio(average: number, peak: number) {
  if (peak <= 0) return 0
  return clamp(average / peak)
}

function loadDimensionPosition(
  average: number,
  peak: number,
  trend: PreCompetitionLoadTrend | null,
) {
  return (sustainedLoadRatio(average, peak) * 0.7) + (trendPosition(trend) * 0.3)
}

function resolveReachedLoadPosition(load: PreCompetitionLoadContext) {
  const volumePosition = loadDimensionPosition(
    load.volume.recentAverageKm,
    load.volume.achievedPeakVolumeKm,
    load.volume.trend,
  )

  const elevationAverage = load.elevation.recentAverageGainM
  const elevationPeak = load.elevation.achievedPeakElevationGainM

  if (elevationAverage === null || elevationPeak === null) {
    return clamp(volumePosition)
  }

  const elevationPosition = loadDimensionPosition(
    elevationAverage,
    elevationPeak,
    load.elevation.trend,
  )

  return clamp((volumePosition + elevationPosition) / 2)
}

function interpolate(min: number, max: number, position: number) {
  return min + ((max - min) * clamp(position))
}

/**
 * Determines formal taper duration in calendar days.
 *
 * Course demand first narrows the usable section of the priority guardrail.
 * Reached load then places the proposal inside that section using relative load
 * sustained within the athlete/group's own recent preparation, never absolute
 * kilometer thresholds.
 */
export function determineTaperDuration(
  priority: CompetitionPriority,
  demand: CompetitionDemandAssessment,
  load: PreCompetitionLoadContext,
): TaperDurationDecision {
  const policy = getCompetitionAdjustmentPolicy(priority)
  const demandPositionRange = DEMAND_POSITION_RANGES[demand.band]
  const reachedLoadPosition = resolveReachedLoadPosition(load)
  const selectedPosition = interpolate(
    demandPositionRange.min,
    demandPositionRange.max,
    reachedLoadPosition,
  )
  const durationDays = Math.round(interpolate(
    policy.taperDurationDays.min,
    policy.taperDurationDays.max,
    selectedPosition,
  ))
  const volumeSustainedLoadRatio = sustainedLoadRatio(
    load.volume.recentAverageKm,
    load.volume.achievedPeakVolumeKm,
  )
  const elevationSustainedLoadRatio = (
    load.elevation.recentAverageGainM !== null
    && load.elevation.achievedPeakElevationGainM !== null
  )
    ? sustainedLoadRatio(
        load.elevation.recentAverageGainM,
        load.elevation.achievedPeakElevationGainM,
      )
    : null
  const reasonCodes: TaperDurationDecision['rationale']['reasonCodes'] = [
    'priority_guardrail',
    demand.band === 'unknown' ? 'course_demand_unknown' : 'course_demand',
    'reached_load',
    elevationSustainedLoadRatio === null
      ? 'elevation_load_unknown'
      : 'elevation_load_available',
  ]

  return {
    priority,
    strategy: policy.defaultStrategy,
    durationDays,
    policyLimitsDays: policy.taperDurationDays,
    demandPositionRange,
    reachedLoadPosition,
    requiresCoachReview: demand.band === 'unknown' || demand.confidence === 'low',
    rationale: {
      demandBand: demand.band,
      demandConfidence: demand.confidence,
      volumeTrend: load.volume.trend,
      elevationTrend: load.elevation.trend,
      volumeSustainedLoadRatio,
      elevationSustainedLoadRatio,
      reasonCodes,
    },
  }
}
