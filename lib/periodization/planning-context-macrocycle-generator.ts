import { addDays, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'

import {
  determineProgressionDurationProfile,
  determineTaperingWeeksCount,
  generateCompetitiveMesocycle,
  generateTrainingMesocycles,
  getUnreachableMaximumWarning,
} from '@/lib/periodization/macrocycle-generator'
import { resolveLegacyPlanningIntent } from '@/lib/periodization/planning-intent'
import { assessPlanningRaceDistance } from '@/lib/periodization/race-distance-context'
import { validateLoadStrategy } from '@/lib/periodization/load-strategy-validator'

import type {
  AthleteGroupCode,
  CompetitionContext,
  GeneratedMacrocycleDraft,
  LoadStrategyDraft,
  PlanningIntent,
} from '@/types'

export type PlanningContextGenerationErrorCode =
  | 'INVALID_DATE'
  | 'MACROCYCLE_TITLE_REQUIRED'
  | 'LOAD_STRATEGY_GROUP_MISMATCH'
  | 'LOAD_STRATEGY_INTENT_MISMATCH'
  | 'LOAD_STRATEGY_INVALID'
  | 'COMPETITION_NAME_REQUIRED'
  | 'COMPETITION_DISTANCE_INVALID'
  | 'COMPETITION_ELEVATION_INVALID'
  | 'MACROCYCLE_DATE_ORDER_INVALID'
  | 'MACROCYCLE_MIN_DURATION'
  | 'INSUFFICIENT_TIME_FOR_TAPER'
  | 'TAPER_UNDETERMINED'
  | 'PRE_TAPER_PEAK_UNDETERMINED'

export class PlanningContextGenerationError extends Error {
  constructor(readonly code: PlanningContextGenerationErrorCode) {
    super(code)
    this.name = 'PlanningContextGenerationError'
  }
}

export interface PlanningContextMacrocycleGeneratorParams {
  title: string
  planningIntent: PlanningIntent
  startDate: string
  endDate: string
  athleteGroup: AthleteGroupCode
  loadStrategy: LoadStrategyDraft
  competitionContext?: CompetitionContext
}

function fail(code: PlanningContextGenerationErrorCode): never {
  throw new PlanningContextGenerationError(code)
}

function parseRequiredDate(value: string) {
  const date = parseISO(value)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !isValid(date)) {
    fail('INVALID_DATE')
  }

  return date
}

function validateCompetitionContext(competitionContext: CompetitionContext | undefined) {
  const competition = competitionContext?.primaryCompetition
  if (!competition) return

  if (!competition.name.trim()) {
    fail('COMPETITION_NAME_REQUIRED')
  }

  if (!Number.isFinite(competition.distanceKm) || competition.distanceKm <= 0) {
    fail('COMPETITION_DISTANCE_INVALID')
  }

  if (
    competition.elevationGain !== undefined
    && (!Number.isInteger(competition.elevationGain) || competition.elevationGain < 0)
  ) {
    fail('COMPETITION_ELEVATION_INVALID')
  }
}

function validateParams(params: PlanningContextMacrocycleGeneratorParams) {
  if (!params.title.trim()) {
    fail('MACROCYCLE_TITLE_REQUIRED')
  }

  if (params.loadStrategy.context.athleteGroup !== params.athleteGroup) {
    fail('LOAD_STRATEGY_GROUP_MISMATCH')
  }

  if (resolveLegacyPlanningIntent(params.loadStrategy.context.goalType) !== params.planningIntent) {
    fail('LOAD_STRATEGY_INTENT_MISMATCH')
  }

  if (!validateLoadStrategy(params.loadStrategy).isValid) {
    fail('LOAD_STRATEGY_INVALID')
  }

  validateCompetitionContext(params.competitionContext)
}

/**
 * Generates a macrocycle from the new H9 planning boundary.
 *
 * Competitive behavior is controlled exclusively by `competitionContext`.
 * `loadStrategy.context.goalType` remains transitional metadata and is used only
 * to verify compatibility with `planningIntent`; it does not activate tapering
 * or competitive mesocycles.
 *
 * Errors from this new boundary use locale-neutral codes so UI/server boundaries
 * can translate them through next-intl instead of embedding product copy here.
 */
export function generateMacrocycleFromPlanningContext(
  params: PlanningContextMacrocycleGeneratorParams,
): GeneratedMacrocycleDraft {
  validateParams(params)

  const start = parseRequiredDate(params.startDate)
  const end = parseRequiredDate(params.endDate)
  const planningDays = differenceInCalendarDays(end, start) + 1

  if (planningDays <= 0) {
    fail('MACROCYCLE_DATE_ORDER_INVALID')
  }

  const totalWeeks = Math.ceil(planningDays / 7)
  if (totalWeeks < 4) {
    fail('MACROCYCLE_MIN_DURATION')
  }

  const primaryCompetition = params.competitionContext?.primaryCompetition ?? undefined
  const taperingWeeksCount = determineTaperingWeeksCount(
    params.athleteGroup,
    primaryCompetition,
    params.loadStrategy.values.maximumWeeklyVolumeKm,
  )
  const trainingWeeksCount = totalWeeks - taperingWeeksCount

  if (trainingWeeksCount < 2) {
    fail('INSUFFICIENT_TIME_FOR_TAPER')
  }

  const progressionDurationProfile = determineProgressionDurationProfile(trainingWeeksCount)
  const mesocycles = generateTrainingMesocycles({
    startDate: params.startDate,
    endDate: params.endDate,
    trainingWeeksCount,
    athleteGroup: params.athleteGroup,
    loadStrategy: params.loadStrategy,
    finishesBeforeTaper: Boolean(primaryCompetition),
  })
  const currentWeekStart = addDays(start, trainingWeeksCount * 7)
  const globalWeekCounter = trainingWeeksCount + 1
  const numberOfTrainingMesocycles = mesocycles.length
  const finalTrainingPeakVolumeKm = mesocycles.at(-1)?.targetPeakVolumeKm
  const finalTrainingPeakElevationGain = mesocycles.at(-1)?.targetPeakElevationGain ?? null
  const maximumWarning = getUnreachableMaximumWarning(
    finalTrainingPeakVolumeKm,
    params.loadStrategy.values.maximumWeeklyVolumeKm,
  )
  const generationWarnings = maximumWarning ? [maximumWarning] : []

  if (primaryCompetition) {
    if (taperingWeeksCount === 0) {
      fail('TAPER_UNDETERMINED')
    }

    if (finalTrainingPeakVolumeKm === undefined) {
      fail('PRE_TAPER_PEAK_UNDETERMINED')
    }

    mesocycles.push(generateCompetitiveMesocycle({
      startDate: format(currentWeekStart, 'yyyy-MM-dd'),
      endDate: params.endDate,
      startWeekNumber: globalWeekCounter,
      mesocycleNumber: numberOfTrainingMesocycles + 1,
      race: primaryCompetition,
      taperingWeeksCount,
      finalTrainingPeakVolumeKm,
      finalTrainingPeakElevationGain,
    }))
  }

  return {
    title: params.title.trim(),
    // Transitional legacy metadata retained until load/intensity persistence is migrated.
    goalType: params.loadStrategy.context.goalType,
    planningIntent: params.planningIntent,
    athleteGroup: params.athleteGroup,
    startDate: params.startDate,
    endDate: params.endDate,
    taperingWeeksCount,
    trainingWeeksCount,
    progressionDurationProfile,
    race: primaryCompetition
      ? {
          name: primaryCompetition.name.trim(),
          date: primaryCompetition.date,
          distanceKm: primaryCompetition.distanceKm,
          elevationGain: primaryCompetition.elevationGain,
        }
      : null,
    generationWarnings,
    raceDistanceCompatibility: assessPlanningRaceDistance(
      params.athleteGroup,
      primaryCompetition,
    ),
    mesocycles,
  }
}
