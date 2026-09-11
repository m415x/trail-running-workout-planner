import { getCompetitionAdjustmentPolicy } from '@/lib/periodization/competition-adjustment-policy'
import { assessCompetitionDemand } from '@/lib/periodization/competition-demand-assessment'
import { buildCompetitionWeekLoad } from '@/lib/periodization/competition-week-load'
import { calculateTaperElevationReductionCurve } from '@/lib/periodization/taper-elevation-reduction-curve'
import { decideTaperIntensityPreservation } from '@/lib/periodization/taper-intensity-preservation'
import { determineTaperDuration } from '@/lib/periodization/taper-duration-decision'
import { calculateTaperVolumeReductionCurve } from '@/lib/periodization/taper-volume-reduction-curve'

import type {
  CompetitionCAdjustmentInput,
  CompetitionCAdjustmentProposal,
  CompetitionDemandBand,
  CompetitionWeekTrainingLoad,
  TaperIntensityPreservationDecision,
} from '@/types'

const TRAINING_STIMULUS_DEMAND_BANDS: readonly CompetitionDemandBand[] = [
  'very_low',
  'low',
  'moderate',
]

const HIGH_RECOVERY_DEMAND_BANDS: readonly CompetitionDemandBand[] = [
  'high',
  'very_high',
  'extreme',
]

function minKnown(left: number | null, right: number | null) {
  if (left === null) return right
  if (right === null) return left
  return Math.min(left, right)
}

function resolveCompetitionWeekTraining(
  input: CompetitionCAdjustmentInput,
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

function canUseCompetitionAsTrainingStimulus(
  input: CompetitionCAdjustmentInput,
  demandBand: CompetitionDemandBand,
) {
  const policy = getCompetitionAdjustmentPolicy('C')

  return (
    policy.allowCompetitionAsTrainingStimulus
    && input.competitionWeekContext.role !== 'recovery'
    && TRAINING_STIMULUS_DEMAND_BANDS.includes(demandBand)
  )
}

function accountForCompetitionAsQualityStimulus(
  intensity: TaperIntensityPreservationDecision,
  competitionActsAsQualityStimulus: boolean,
): TaperIntensityPreservationDecision {
  if (!competitionActsAsQualityStimulus) return intensity

  // The competition replaces one exposure from the original weekly reference.
  // Taper preservation may already have reduced that count, so subtracting from
  // the proposed value would double-reduce the remaining quality work.
  const remainingPlannedQualityExposures = Math.max(
    0,
    intensity.reference.intenseSessionsTarget - 1,
  )

  return {
    ...intensity,
    proposed: {
      ...intensity.proposed,
      intenseSessionsTarget: Math.min(
        intensity.proposed.intenseSessionsTarget,
        remainingPlannedQualityExposures,
      ),
    },
  }
}

/**
 * Builds a pure local proposal for a C-priority competition.
 *
 * A short/moderate C outside a recovery week may replace one planned quality
 * exposure. Demanding C events remain secondary in planning role but keep their
 * physiological demand explicit for the later recovery policy. Priority never
 * downgrades the assessed event demand.
 */
export function buildCompetitionCAdjustmentProposal(
  input: CompetitionCAdjustmentInput,
): CompetitionCAdjustmentProposal {
  const {
    competition,
    courseProfile,
    preCompetitionLoad,
    intensityReference,
  } = input

  if (competition.priority !== 'C') {
    throw new Error('Specific-stimulus competition adjustment requires a C-priority competition.')
  }

  const demand = assessCompetitionDemand(courseProfile)
  const duration = determineTaperDuration('C', demand, preCompetitionLoad)
  const volumeCurve = calculateTaperVolumeReductionCurve(duration, preCompetitionLoad)
  const elevationCurve = calculateTaperElevationReductionCurve(
    duration,
    preCompetitionLoad,
    demand,
    volumeCurve.finalReductionPercentage,
  )
  const baseIntensity = decideTaperIntensityPreservation(duration, intensityReference)
  const competitionActsAsQualityStimulus = canUseCompetitionAsTrainingStimulus(input, demand.band)
  const intensity = accountForCompetitionAsQualityStimulus(
    baseIntensity,
    competitionActsAsQualityStimulus,
  )

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
  const physiologicalDemandRequiresRecoveryReview = HIGH_RECOVERY_DEMAND_BANDS.includes(demand.band)

  return {
    priority: 'C',
    strategy: 'specific_stimulus',
    treatment: competitionActsAsQualityStimulus ? 'training_stimulus' : 'minimal_adjustment',
    competitionId: competition.competitionId,
    competitionDate: competition.date,
    competitionWeekRole: input.competitionWeekContext.role,
    competitionActsAsQualityStimulus,
    physiologicalDemandRequiresRecoveryReview,
    demand,
    duration,
    volumeCurve,
    elevationCurve,
    intensity,
    competitionWeek,
    requiresCoachReview:
      demand.band === 'unknown'
      || duration.requiresCoachReview
      || elevationCurve.requiresCoachReview
      || intensity.requiresCoachReview,
  }
}
