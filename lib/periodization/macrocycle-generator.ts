import { addDays, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'

import { GROUP_VOLUME_MATRIX } from '@/data/periodization-matrix'
import { TSB_TARGETS_BY_MICROCYCLE } from '@/types'

import type {
  AthleteCategoryCode,
  AthleteGroupCode,
  GeneratedMacrocycleDraft,
  GeneratedMesocycleDraft,
  GeneratedMicrocycleDraft,
  MicrocycleType,
  TrainingGoalType,
  VolumeMatrixMicrocycleType,
} from '@/types'

const STANDARD_MESOCYCLE_SEQUENCE: VolumeMatrixMicrocycleType[] = ['base', 'development', 'shock', 'deload']

const ELEVATION_RATIO_BY_GROUP_PREFIX: Record<AthleteCategoryCode, number> = {
  E: 35,
  U: 45,
  M: 30,
  H: 25,
  S: 20,
  B: 15,
}

export interface OptionalTargetRace {
  name: string
  distanceKm: number
  elevationGain?: number
}

export interface MacrocycleGeneratorParams {
  title: string
  goalType: TrainingGoalType
  startDate: string
  endDate: string
  athleteGroup: AthleteGroupCode
  race?: OptionalTargetRace
}

function parseRequiredDate(value: string, fieldName: string) {
  const date = parseISO(value)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !isValid(date)) {
    throw new Error(`${fieldName} debe ser una fecha válida con formato YYYY-MM-DD.`)
  }

  return date
}

function validateParams(params: MacrocycleGeneratorParams) {
  if (!params.title.trim()) {
    throw new Error('El macrociclo debe tener un título.')
  }

  if (params.goalType === 'race' && !params.race) {
    throw new Error('Un objetivo de carrera requiere los datos de la carrera.')
  }

  if (params.goalType !== 'race' && params.race) {
    throw new Error('Los objetivos sin carrera no deben incluir datos de carrera.')
  }

  if (params.race) {
    if (!params.race.name.trim()) {
      throw new Error('La carrera debe tener un nombre.')
    }

    if (!Number.isFinite(params.race.distanceKm) || params.race.distanceKm <= 0) {
      throw new Error('La distancia de la carrera debe ser mayor que cero.')
    }

    if (
      params.race.elevationGain !== undefined
      && (!Number.isInteger(params.race.elevationGain) || params.race.elevationGain < 0)
    ) {
      throw new Error('El desnivel de la carrera debe ser un entero no negativo.')
    }
  }
}

function getTaperingWeeksCount(group: AthleteGroupCode, race: OptionalTargetRace | undefined): 0 | 2 | 3 {
  if (!race) return 0

  return race.distanceKm >= 42 || group.startsWith('E') || group.startsWith('U') ? 3 : 2
}

function createNotes(type: MicrocycleType, volumeKm: number, elevationGain: number, prefix?: string) {
  const tsbTarget = TSB_TARGETS_BY_MICROCYCLE[type]
  const summary = `Objetivo: ${volumeKm} km | +${elevationGain}m D+ | TSB esperado: [${tsbTarget.min} a ${tsbTarget.max}]`

  return prefix ? `${prefix}. ${summary}` : summary
}

export function generateFractalMacrocycle(params: MacrocycleGeneratorParams): GeneratedMacrocycleDraft {
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

  const taperingWeeksCount = getTaperingWeeksCount(params.athleteGroup, params.race)
  const trainingWeeksCount = totalWeeks - taperingWeeksCount

  if (trainingWeeksCount < 1) {
    throw new Error('El período disponible no alcanza para incluir entrenamiento y tapering.')
  }

  const volumeProgression = GROUP_VOLUME_MATRIX[params.athleteGroup]
  const athleteCategory = params.athleteGroup.charAt(0) as AthleteCategoryCode
  const elevationRatio = ELEVATION_RATIO_BY_GROUP_PREFIX[athleteCategory]
  const mesocycles: GeneratedMesocycleDraft[] = []
  let currentWeekStart = start
  let globalWeekCounter = 1
  const numberOfTrainingMesocycles = Math.ceil(trainingWeeksCount / 4)

  for (let mesocycleIndex = 0; mesocycleIndex < numberOfTrainingMesocycles; mesocycleIndex++) {
    const weeksInMesocycle = Math.min(4, trainingWeeksCount - mesocycleIndex * 4)
    const microcycles: GeneratedMicrocycleDraft[] = []

    for (let microcycleIndex = 0; microcycleIndex < weeksInMesocycle; microcycleIndex++) {
      const type = STANDARD_MESOCYCLE_SEQUENCE[microcycleIndex]
      const weekEnd = new Date(Math.min(addDays(currentWeekStart, 6).getTime(), end.getTime()))
      const targetVolumeKm = volumeProgression.volumes[type]
      const targetElevationGain = Math.round(targetVolumeKm * elevationRatio)

      microcycles.push({
        weekNumber: globalWeekCounter,
        type,
        startDate: format(currentWeekStart, 'yyyy-MM-dd'),
        endDate: format(weekEnd, 'yyyy-MM-dd'),
        targetVolumeKm,
        targetElevationGain,
        notes: createNotes(type, targetVolumeKm, targetElevationGain),
      })

      currentWeekStart = addDays(currentWeekStart, 7)
      globalWeekCounter++
    }

    mesocycles.push({
      title: `Mesociclo ${mesocycleIndex + 1}: ${mesocycleIndex === numberOfTrainingMesocycles - 1 ? 'Pico y especificidad' : 'Desarrollo y carga'}`,
      number: mesocycleIndex + 1,
      period: mesocycleIndex === 0 ? 'general_preparatory' : 'specific_preparatory',
      objective: `Bloque de ondulación fractal (${weeksInMesocycle} semanas)`,
      microcycles,
    })
  }

  if (params.race) {
    const taperingMicrocycles: GeneratedMicrocycleDraft[] = []
    const peakVolume = volumeProgression.volumes.shock
    const taperingFactors = taperingWeeksCount === 3 ? [0.6, 0.4] : [0.6]

    taperingFactors.forEach((volumeFactor) => {
      const weekEnd = new Date(Math.min(addDays(currentWeekStart, 6).getTime(), end.getTime()))
      const targetVolumeKm = Math.round(peakVolume * volumeFactor)
      const targetElevationGain = Math.round(targetVolumeKm * elevationRatio * 0.7)

      taperingMicrocycles.push({
        weekNumber: globalWeekCounter,
        type: 'tapering',
        startDate: format(currentWeekStart, 'yyyy-MM-dd'),
        endDate: format(weekEnd, 'yyyy-MM-dd'),
        targetVolumeKm,
        targetElevationGain,
        notes: createNotes('tapering', targetVolumeKm, targetElevationGain, `Tapering: reducción al ${Math.round(volumeFactor * 100)}%`),
      })

      currentWeekStart = addDays(currentWeekStart, 7)
      globalWeekCounter++
    })

    const raceWeekEnd = new Date(Math.min(addDays(currentWeekStart, 6).getTime(), end.getTime()))
    const raceWeekVolumeKm = Math.max(params.race.distanceKm, Math.round(peakVolume * 0.35))
    const raceWeekElevationGain = params.race.elevationGain
      ?? Math.round(raceWeekVolumeKm * elevationRatio * 0.7)

    taperingMicrocycles.push({
      weekNumber: globalWeekCounter,
      type: 'race',
      startDate: format(currentWeekStart, 'yyyy-MM-dd'),
      endDate: format(raceWeekEnd, 'yyyy-MM-dd'),
      targetVolumeKm: raceWeekVolumeKm,
      targetElevationGain: raceWeekElevationGain,
      notes: createNotes('race', raceWeekVolumeKm, raceWeekElevationGain, `Competencia: ${params.race.name}`),
    })

    mesocycles.push({
      title: 'Mesociclo competitivo: tapering y carrera',
      number: numberOfTrainingMesocycles + 1,
      period: 'competitive',
      objective: 'Afinamiento, supercompensación y pico de rendimiento',
      microcycles: taperingMicrocycles,
    })
  }

  return {
    title: params.title.trim(),
    goalType: params.goalType,
    athleteGroup: params.athleteGroup,
    startDate: params.startDate,
    endDate: params.endDate,
    taperingWeeksCount,
    race: params.race
      ? {
          name: params.race.name.trim(),
          distanceKm: params.race.distanceKm,
          elevationGain: params.race.elevationGain,
        }
      : null,
    mesocycles,
  }
}
