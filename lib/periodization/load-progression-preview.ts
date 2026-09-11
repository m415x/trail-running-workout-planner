import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns'

import {
  determineProgressionDurationProfile,
  generateFractalMacrocycle,
  generateTrainingMesocycles,
  getUnreachableMaximumWarning,
} from '@/lib/periodization/macrocycle-generator'
import { generateMacrocycleFromPlanningContext } from '@/lib/periodization/planning-context-macrocycle-generator'
import { resolveLegacyPlanningIntent } from '@/lib/periodization/planning-intent'
import { assessElevationDensity } from '@/lib/periodization/elevation-density-validator'
import { validateLoadStrategy } from '@/lib/periodization/load-strategy-validator'
import { assessPlanningRaceDistance } from '@/lib/periodization/race-distance-context'
import {
  reconcilePlanningRegeneration,
  type ExistingMicrocycleVolume,
} from '@/lib/periodization/planning-regeneration'
import type {
  CompetitionContext,
  GeneratedMacrocycleDraft,
  LoadStrategyDraft,
  TargetRaceSnapshot,
} from '@/types'

export interface LoadProgressionPreviewParams {
  title: string
  startDate: string
  endDate: string
  loadStrategy: LoadStrategyDraft
  /** Preferred H9 competitive boundary. */
  competitionContext?: CompetitionContext
  /** Legacy compatibility input retained for callers not yet migrated to H9. */
  targetRace?: TargetRaceSnapshot | null
  finishesBeforeTaper?: boolean
  existingMicrocycles?: ExistingMicrocycleVolume[]
}

export function determineTrainingProgressionEndDate(
  macrocycleEndDate: string,
  protectedBlockStartDates: string[],
) {
  const firstProtectedStartDate = [...protectedBlockStartDates].sort()[0]

  return firstProtectedStartDate
    ? format(subDays(parseISO(firstProtectedStartDate), 1), 'yyyy-MM-dd')
    : macrocycleEndDate
}

export function buildLoadProgressionPreview({
  title,
  startDate,
  endDate,
  loadStrategy,
  competitionContext,
  targetRace = null,
  finishesBeforeTaper = false,
  existingMicrocycles = [],
}: LoadProgressionPreviewParams) {
  const completePlanning = competitionContext
    ? generateMacrocycleFromPlanningContext({
        title,
        planningIntent: resolveLegacyPlanningIntent(loadStrategy.context.goalType),
        startDate,
        endDate,
        athleteGroup: loadStrategy.context.athleteGroup,
        loadStrategy,
        competitionContext,
      })
    : targetRace
      ? generateFractalMacrocycle({
          title,
          goalType: loadStrategy.context.goalType,
          startDate,
          endDate,
          athleteGroup: loadStrategy.context.athleteGroup,
          loadStrategy,
          race: targetRace,
        })
      : null
  const trainingWeeksCount = Math.ceil(
    (differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1) / 7,
  )
  const mesocycles = completePlanning?.mesocycles ?? generateTrainingMesocycles({
    startDate,
    endDate,
    trainingWeeksCount,
    athleteGroup: loadStrategy.context.athleteGroup,
    loadStrategy,
    finishesBeforeTaper,
  })
  const maximumWarning = getUnreachableMaximumWarning(
    mesocycles.at(-1)?.targetPeakVolumeKm,
    loadStrategy.values.maximumWeeklyVolumeKm,
  )
  const strategyWarnings = validateLoadStrategy(loadStrategy).warnings
    .filter((warning) => warning.code.includes('elevation-density'))
    .map((warning) => warning.message)
  const competitiveRace = competitionContext?.primaryCompetition ?? targetRace
  const raceDensityWarning = competitiveRace?.elevationGain === undefined
    ? null
    : assessElevationDensity(competitiveRace.distanceKm, competitiveRace.elevationGain).warning
  const generatedPlanning: GeneratedMacrocycleDraft = completePlanning ?? {
    title,
    goalType: loadStrategy.context.goalType,
    athleteGroup: loadStrategy.context.athleteGroup,
    startDate,
    endDate,
    taperingWeeksCount: 0,
    trainingWeeksCount,
    progressionDurationProfile: determineProgressionDurationProfile(trainingWeeksCount),
    race: null,
    raceDistanceCompatibility: assessPlanningRaceDistance(loadStrategy.context.athleteGroup, null),
    generationWarnings: maximumWarning ? [maximumWarning] : [],
    mesocycles,
  }

  generatedPlanning.generationWarnings = [
    ...generatedPlanning.generationWarnings,
    ...strategyWarnings,
    ...(raceDensityWarning ? [raceDensityWarning] : []),
  ]

  return reconcilePlanningRegeneration({
    generatedPlanning,
    existingMicrocycles,
    loadStrategy,
  })
}
