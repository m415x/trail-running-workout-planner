import type {
  CompetitionWeekCompetitionLoad,
  CompetitionWeekLoad,
  CompetitionWeekTrainingLoad,
} from '@/types'

function validateNonNegativeFinite(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be finite and non-negative.`)
  }
}

function validateOptionalNonNegativeFinite(value: number | null, field: string) {
  if (value !== null) validateNonNegativeFinite(value, field)
}

/**
 * Creates the race-week load boundary without folding competition exposure into
 * the prescribed training target.
 *
 * Total exposure is derived for reporting only. D+ total remains unknown when
 * either training or competition D+ is unknown; the function never invents
 * zero elevation to make the arithmetic complete.
 */
export function buildCompetitionWeekLoad(
  training: CompetitionWeekTrainingLoad,
  competition: CompetitionWeekCompetitionLoad,
): CompetitionWeekLoad {
  validateNonNegativeFinite(training.volumeKm, 'training.volumeKm')
  validateOptionalNonNegativeFinite(training.elevationGainM, 'training.elevationGainM')
  validateNonNegativeFinite(competition.distanceKm, 'competition.distanceKm')
  validateOptionalNonNegativeFinite(competition.elevationGainM, 'competition.elevationGainM')

  if (competition.competitionId.trim().length === 0) {
    throw new Error('competition.competitionId is required.')
  }

  if (competition.name.trim().length === 0) {
    throw new Error('competition.name is required.')
  }

  if (competition.date.trim().length === 0) {
    throw new Error('competition.date is required.')
  }

  const totalElevationGainM = (
    training.elevationGainM !== null
    && competition.elevationGainM !== null
  )
    ? training.elevationGainM + competition.elevationGainM
    : null

  return {
    training: { ...training },
    competition: { ...competition },
    totalExposure: {
      distanceKm: training.volumeKm + competition.distanceKm,
      elevationGainM: totalElevationGainM,
    },
  }
}
