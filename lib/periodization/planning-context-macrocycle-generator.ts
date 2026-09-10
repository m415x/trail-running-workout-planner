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

export interface PlanningContextMacrocycleGeneratorParams {
  title: string
  planningIntent: PlanningIntent
  startDate: string
  endDate: string
  athleteGroup: AthleteGroupCode
  loadStrategy: LoadStrategyDraft
  competitionContext?: CompetitionContext
}

function parseRequiredDate(value: string, fieldName: string) {
  const date = parseISO(value)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !isValid(date)) {
    throw new Error(`${fieldName} debe ser una fecha válida con formato YYYY-MM-DD.`)
  }

  return date
}

function validateCompetitionContext(competitionContext: CompetitionContext | undefined) {
  const competition = competitionContext?.primaryCompetition
  if (!competition) return

  if (!competition.name.trim()) {
    throw new Error('La carrera debe tener un nombre.')
  }

  if (!Number.isFinite(competition.distanceKm) || competition.distanceKm <= 0) {
    throw new Error('La distancia de la carrera debe ser mayor que cero.')
  }

  if (
    competition.elevationGain !== undefined
    && (!Number.isInteger(competition.elevationGain) || competition.elevationGain < 0)
  ) {
    throw new Error('El desnivel de la carrera debe ser un entero no negativo.')
  }
}

function validateParams(params: PlanningContextMacrocycleGeneratorParams) {
  if (!params.title.trim()) {
    throw new Error('El macrociclo debe tener un título.')
  }

  if (params.loadStrategy.context.athleteGroup !== params.athleteGroup) {
    throw new Error('La estrategia de carga pertenece a otro grupo.')
  }

  if (resolveLegacyPlanningIntent(params.loadStrategy.context.goalType) !== params.planningIntent) {
    throw new Error('La estrategia de carga pertenece a otra intención de planificación.')
  }

  const strategyValidation = validateLoadStrategy(params.loadStrategy)

  if (!strategyValidation.isValid) {
    throw new Error(
      strategyValidation.errors[0]?.message ?? 'La estrategia de carga no es válida.',
    )
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
 */
export function generateMacrocycleFromPlanningContext(
  params: PlanningContextMacrocycleGeneratorParams,
): GeneratedMacrocycleDraft {
  validateParams(params)

  const start = parseRequiredDate(params.startDate, 'startDate')
  const end = parseRequiredDate(params.endDate, 'endDate')
  const planningDays = differenceInCalendarDays(end, start) + 1

  if (planningDays <= 0) {
    throw new Error('endDate debe ser posterior o igual a startDate.')
  }

  const totalWeeks = Math.ceil(planningDays / 7)
  if (totalWeeks < 4) {
    throw new Error('El macrociclo debe tener al menos 4 semanas de planificación.')
  }

  const primaryCompetition = params.competitionContext?.primaryCompetition
  const taperingWeeksCount = determineTaperingWeeksCount(
    params.athleteGroup,
    primaryCompetition,
    params.loadStrategy.values.maximumWeeklyVolumeKm,
  )
  const trainingWeeksCount = totalWeeks - taperingWeeksCount

  if (trainingWeeksCount < 2) {
    throw new Error('El período disponible no alcanza para incluir entrenamiento y tapering.')
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
      throw new Error('No se pudo determinar el tapering para la carrera.')
    }

    if (finalTrainingPeakVolumeKm === undefined) {
      throw new Error('No se pudo determinar el pico de carga previo al tapering.')
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
