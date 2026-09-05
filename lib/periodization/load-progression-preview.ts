import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns'

import {
  determineProgressionDurationProfile,
  generateTrainingMesocycles,
  getUnreachableMaximumWarning,
} from '@/lib/periodization/macrocycle-generator'
import { assessElevationDensity } from '@/lib/periodization/elevation-density-validator'
import { validateLoadStrategy } from '@/lib/periodization/load-strategy-validator'
import {
  reconcilePlanningRegeneration,
  type ExistingMicrocycleVolume,
} from '@/lib/periodization/planning-regeneration'
import type { GeneratedMacrocycleDraft, LoadStrategyDraft, TargetRaceSnapshot } from '@/types'

export interface LoadProgressionPreviewParams {
  title: string
  startDate: string
  endDate: string
  loadStrategy: LoadStrategyDraft
  targetRace?: TargetRaceSnapshot | null
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
  targetRace = null,
  existingMicrocycles = [],
}: LoadProgressionPreviewParams) {
  const trainingWeeksCount = Math.ceil(
    (differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1) / 7,
  )
  const mesocycles = generateTrainingMesocycles({
    startDate,
    endDate,
    trainingWeeksCount,
    athleteGroup: loadStrategy.context.athleteGroup,
    loadStrategy,
  })
  const maximumWarning = getUnreachableMaximumWarning(
    mesocycles.at(-1)?.targetPeakVolumeKm,
    loadStrategy.values.maximumWeeklyVolumeKm,
  )
  const strategyWarnings = validateLoadStrategy(loadStrategy).warnings
    .filter((warning) => warning.code.includes('elevation-density'))
    .map((warning) => warning.message)
  const raceDensityWarning = targetRace?.elevationGain === undefined
    ? null
    : assessElevationDensity(targetRace.distanceKm, targetRace.elevationGain).warning
  const generatedPlanning: GeneratedMacrocycleDraft = {
    title,
    goalType: loadStrategy.context.goalType,
    athleteGroup: loadStrategy.context.athleteGroup,
    startDate,
    endDate,
    taperingWeeksCount: 0,
    trainingWeeksCount,
    progressionDurationProfile: determineProgressionDurationProfile(trainingWeeksCount),
    race: targetRace,
    generationWarnings: [
      ...(maximumWarning ? [maximumWarning] : []),
      ...strategyWarnings,
      ...(raceDensityWarning ? [raceDensityWarning] : []),
    ],
    mesocycles,
  }

  return reconcilePlanningRegeneration({
    generatedPlanning,
    existingMicrocycles,
    loadStrategy,
  })
}
