import { assessCompetitionDemand } from '@/lib/periodization/competition-demand-assessment'
import { buildCompetitionWeekLoad } from '@/lib/periodization/competition-week-load'
import { calculateTaperElevationReductionCurve } from '@/lib/periodization/taper-elevation-reduction-curve'
import { decideTaperIntensityPreservation } from '@/lib/periodization/taper-intensity-preservation'
import { determineTaperDuration } from '@/lib/periodization/taper-duration-decision'
import { calculateTaperVolumeReductionCurve } from '@/lib/periodization/taper-volume-reduction-curve'

import type {
  CompetitionBAdjustmentInput,
  CompetitionBAdjustmentProposal,
  CompetitionWeekTrainingLoad,
} from '@/types'

function minKnown(left: number | null, right: number | null) {
  if (left === null) return right
  if (right === null) return left
  return Math.min(left, right)
}

/**
 * Keeps a B race subordinate to the existing plan: a mini-taper may reduce the
 * current week's training target, but it never raises an already planned
 * recovery week or promotes the race to a primary peak.
 */
function resolveCompetitionWeekTraining(
  input: CompetitionBAdjustmentInput,
  durationDays: number,
  taperTraining: CompetitionWeekTrainingLoad | null,
): CompetitionWeekTrainingLoad {
  const planned = input.competitionWeekContext.plannedTraining

  if (durationDays === 0 || taperTraining === null) {
    return { ...planned }
  }

  return {
    volumeKm: Math.min(planned.volumeKm, taperTraining.volumeKm),
    elevationGainM: minKnown(planned.elevationGainM, taperTraining.elevationGainM),
  }
}

/**
 * Composes a pure local adjustment proposal for an intermediate B competition.
 *
 * Priority B may resolve to no formal taper. When it does, the existing week is
 * preserved. When a mini-taper is selected, the generated taper targets act as
 * ceilings over the existing week, so a nearby recovery week is never increased
 * merely to satisfy competition-specific targets.
 */
export function buildCompetitionBAdjustmentProposal(
  input: CompetitionBAdjustmentInput,
): CompetitionBAdjustmentProposal {
  const {
    competition,
    courseProfile,
    preCompetitionLoad,
    intensityReference,
  } = input

  if (competition.priority !== 'B') {
    throw new Error('Proportional competition adjustment requires a B-priority competition.')
  }

  const demand = assessCompetitionDemand(courseProfile)
  const duration = determineTaperDuration('B', demand, preCompetitionLoad)
  const volumeCurve = calculateTaperVolumeReductionCurve(duration, preCompetitionLoad)
  const elevationCurve = calculateTaperElevationReductionCurve(
    duration,
    preCompetitionLoad,
    demand,
    volumeCurve.finalReductionPercentage,
  )
  const intensity = decideTaperIntensityPreservation(duration, intensityReference)

  const finalVolumePoint = volumeCurve.points.at(-1)
  const finalElevationPoint = elevationCurve.points.at(-1)
  const taperTraining = finalVolumePoint
    ? {
        volumeKm: finalVolumePoint.targetWeeklyEquivalentVolumeKm,
        elevationGainM: finalElevationPoint?.targetWeeklyEquivalentElevationGainM ?? null,
      }
    : null
  const training = resolveCompetitionWeekTraining(input, duration.durationDays, taperTraining)
  const competitionWeek = buildCompetitionWeekLoad(training, competition)

  return {
    priority: 'B',
    strategy: 'proportional_adjustment',
    competitionId: competition.competitionId,
    competitionDate: competition.date,
    competitionWeekRole: input.competitionWeekContext.role,
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
