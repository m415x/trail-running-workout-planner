import { assessCompetitionDemand } from '@/lib/periodization/competition-demand-assessment'
import { buildCompetitionWeekLoad } from '@/lib/periodization/competition-week-load'
import { calculateTaperElevationReductionCurve } from '@/lib/periodization/taper-elevation-reduction-curve'
import { decideTaperIntensityPreservation } from '@/lib/periodization/taper-intensity-preservation'
import { determineTaperDuration } from '@/lib/periodization/taper-duration-decision'
import { calculateTaperVolumeReductionCurve } from '@/lib/periodization/taper-volume-reduction-curve'

import type {
  FullCompetitionATaperInput,
  FullCompetitionATaperProposal,
} from '@/types'

/**
 * Composes the pure H10 policies into one full taper proposal for a primary A
 * competition. The proposal is intentionally persistence-free: later impact
 * window/reconciliation code decides whether and how it is applied.
 */
export function buildFullCompetitionATaperProposal(
  input: FullCompetitionATaperInput,
): FullCompetitionATaperProposal {
  const {
    competition,
    courseProfile,
    preCompetitionLoad,
    intensityReference,
  } = input

  if (competition.priority !== 'A') {
    throw new Error('Full competition taper requires an A-priority competition.')
  }

  const demand = assessCompetitionDemand(courseProfile)
  const duration = determineTaperDuration('A', demand, preCompetitionLoad)
  const volumeCurve = calculateTaperVolumeReductionCurve(duration, preCompetitionLoad)
  const elevationCurve = calculateTaperElevationReductionCurve(
    duration,
    preCompetitionLoad,
    demand,
    volumeCurve.finalReductionPercentage,
  )
  const intensity = decideTaperIntensityPreservation(duration, intensityReference)

  const finalVolumePoint = volumeCurve.points.at(-1)

  if (!finalVolumePoint) {
    throw new Error('A-priority taper must produce a non-empty volume curve.')
  }

  const finalElevationPoint = elevationCurve.points.at(-1)
  const competitionWeek = buildCompetitionWeekLoad(
    {
      volumeKm: finalVolumePoint.targetWeeklyEquivalentVolumeKm,
      elevationGainM: finalElevationPoint?.targetWeeklyEquivalentElevationGainM ?? null,
    },
    competition,
  )

  return {
    priority: 'A',
    competitionId: competition.competitionId,
    competitionDate: competition.date,
    demand,
    duration,
    volumeCurve,
    elevationCurve,
    intensity,
    competitionWeek,
    requiresCoachReview:
      duration.requiresCoachReview
      || elevationCurve.requiresCoachReview
      || intensity.requiresCoachReview,
  }
}
