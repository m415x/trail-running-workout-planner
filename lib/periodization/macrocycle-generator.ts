import { addDays, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'

import { calculateTargetVolume } from '@/lib/periodization/target-volume-calculator'
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

export interface MicrocycleTarget {
  type: MicrocycleType
  targetVolumeKm: number
  targetElevationGain: number
  notesPrefix?: string
}

export interface MicrocycleGeneratorParams {
  startDate: string
  endDate: string
  startWeekNumber: number
  targets: MicrocycleTarget[]
}

export function generateMicrocycles({
  startDate,
  endDate,
  startWeekNumber,
  targets,
}: MicrocycleGeneratorParams): GeneratedMicrocycleDraft[] {
  if (!Number.isInteger(startWeekNumber) || startWeekNumber < 1) {
    throw new Error('startWeekNumber debe ser un entero mayor que cero.')
  }

  if (targets.length === 0) {
    throw new Error('Se necesita al menos un objetivo semanal para generar microciclos.')
  }

  const start = parseRequiredDate(startDate, 'startDate')
  const end = parseRequiredDate(endDate, 'endDate')
  const availableDays = differenceInCalendarDays(end, start) + 1

  if (availableDays < (targets.length - 1) * 7 + 1) {
    throw new Error('El rango de fechas no alcanza para los microciclos indicados.')
  }

  return targets.map((target, index) => {
    if (!Number.isFinite(target.targetVolumeKm) || target.targetVolumeKm < 0) {
      throw new Error(`El volumen del microciclo ${startWeekNumber + index} debe ser un número no negativo.`)
    }

    if (!Number.isInteger(target.targetElevationGain) || target.targetElevationGain < 0) {
      throw new Error(`El desnivel del microciclo ${startWeekNumber + index} debe ser un entero no negativo.`)
    }

    const weekStart = addDays(start, index * 7)
    const weekEnd = new Date(Math.min(addDays(weekStart, 6).getTime(), end.getTime()))

    return {
      weekNumber: startWeekNumber + index,
      type: target.type,
      startDate: format(weekStart, 'yyyy-MM-dd'),
      endDate: format(weekEnd, 'yyyy-MM-dd'),
      targetVolumeKm: target.targetVolumeKm,
      targetElevationGain: target.targetElevationGain,
      notes: createNotes(
        target.type,
        target.targetVolumeKm,
        target.targetElevationGain,
        target.notesPrefix,
      ),
    }
  })
}

function distributeWeeksIntoMesocycles(trainingWeeksCount: number) {
  const fullMesocycles = Math.floor(trainingWeeksCount / 4)
  const remainingWeeks = trainingWeeksCount % 4
  const distribution = Array.from({ length: fullMesocycles }, () => 4)

  if (remainingWeeks === 0) return distribution

  if (remainingWeeks === 1 && distribution.length > 0) {
    distribution[distribution.length - 1] = 3
    distribution.push(2)
    return distribution
  }

  distribution.push(remainingWeeks)
  return distribution
}

function getMicrocycleSequence(weeksInMesocycle: number): VolumeMatrixMicrocycleType[] {
  if (weeksInMesocycle === 4) return STANDARD_MESOCYCLE_SEQUENCE

  return [...STANDARD_MESOCYCLE_SEQUENCE.slice(0, weeksInMesocycle - 1), 'deload']
}

export interface TrainingMesocycleGeneratorParams {
  startDate: string
  endDate: string
  trainingWeeksCount: number
  athleteGroup: AthleteGroupCode
}

export function generateTrainingMesocycles({
  startDate,
  endDate,
  trainingWeeksCount,
  athleteGroup,
}: TrainingMesocycleGeneratorParams): GeneratedMesocycleDraft[] {
  if (!Number.isInteger(trainingWeeksCount) || trainingWeeksCount < 2) {
    throw new Error('Se necesitan al menos 2 semanas de entrenamiento para generar mesociclos.')
  }

  const start = parseRequiredDate(startDate, 'startDate')
  const end = parseRequiredDate(endDate, 'endDate')
  const availableDays = differenceInCalendarDays(end, start) + 1

  if (availableDays < (trainingWeeksCount - 1) * 7 + 1) {
    throw new Error('El rango de fechas no alcanza para las semanas de entrenamiento indicadas.')
  }

  const athleteCategory = athleteGroup.charAt(0) as AthleteCategoryCode
  const elevationRatio = ELEVATION_RATIO_BY_GROUP_PREFIX[athleteCategory]
  const weekDistribution = distributeWeeksIntoMesocycles(trainingWeeksCount)
  const mesocycles: GeneratedMesocycleDraft[] = []
  let currentWeekStart = start
  let globalWeekCounter = 1

  weekDistribution.forEach((weeksInMesocycle, mesocycleIndex) => {
    const microcycleSequence = getMicrocycleSequence(weeksInMesocycle)
    const targets = microcycleSequence.map((type): MicrocycleTarget => {
      const targetVolumeKm = calculateTargetVolume({ athleteGroup, type })
      const targetElevationGain = Math.round(targetVolumeKm * elevationRatio)

      return {
        type,
        targetVolumeKm,
        targetElevationGain,
      }
    })
    const microcycles = generateMicrocycles({
      startDate: format(currentWeekStart, 'yyyy-MM-dd'),
      endDate,
      startWeekNumber: globalWeekCounter,
      targets,
    })

    currentWeekStart = addDays(currentWeekStart, weeksInMesocycle * 7)
    globalWeekCounter += weeksInMesocycle

    const isFirstMesocycle = mesocycleIndex === 0
    const isLastMesocycle = mesocycleIndex === weekDistribution.length - 1
    const period = isFirstMesocycle ? 'general_preparatory' : 'specific_preparatory'
    const focus = isFirstMesocycle
      ? 'Adaptación y base'
      : isLastMesocycle
        ? 'Pico y especificidad'
        : 'Desarrollo y carga'

    mesocycles.push({
      title: `Mesociclo ${mesocycleIndex + 1}: ${focus}`,
      number: mesocycleIndex + 1,
      period,
      objective: `${focus} mediante un bloque de ondulación (${weeksInMesocycle} semanas)`,
      microcycles,
    })
  })

  return mesocycles
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

  if (trainingWeeksCount < 2) {
    throw new Error('El período disponible no alcanza para incluir entrenamiento y tapering.')
  }

  const athleteCategory = params.athleteGroup.charAt(0) as AthleteCategoryCode
  const elevationRatio = ELEVATION_RATIO_BY_GROUP_PREFIX[athleteCategory]
  const mesocycles = generateTrainingMesocycles({
    startDate: params.startDate,
    endDate: params.endDate,
    trainingWeeksCount,
    athleteGroup: params.athleteGroup,
  })
  const currentWeekStart = addDays(start, trainingWeeksCount * 7)
  const globalWeekCounter = trainingWeeksCount + 1
  const numberOfTrainingMesocycles = mesocycles.length

  if (params.race) {
    const taperingFactors = taperingWeeksCount === 3 ? [0.6, 0.4] : [0.6]
    const taperingTargets = taperingFactors.map((volumeFactor): MicrocycleTarget => {
      const targetVolumeKm = calculateTargetVolume({
        athleteGroup: params.athleteGroup,
        type: 'tapering',
        volumeFactor,
      })
      const targetElevationGain = Math.round(targetVolumeKm * elevationRatio * 0.7)

      return {
        type: 'tapering',
        targetVolumeKm,
        targetElevationGain,
        notesPrefix: `Tapering: reducción al ${Math.round(volumeFactor * 100)}%`,
      }
    })

    const raceWeekVolumeKm = calculateTargetVolume({
      athleteGroup: params.athleteGroup,
      type: 'race',
      raceDistanceKm: params.race.distanceKm,
    })
    const raceWeekElevationGain = params.race.elevationGain
      ?? Math.round(raceWeekVolumeKm * elevationRatio * 0.7)
    const taperingMicrocycles = generateMicrocycles({
      startDate: format(currentWeekStart, 'yyyy-MM-dd'),
      endDate: params.endDate,
      startWeekNumber: globalWeekCounter,
      targets: [
        ...taperingTargets,
        {
          type: 'race',
          targetVolumeKm: raceWeekVolumeKm,
          targetElevationGain: raceWeekElevationGain,
          notesPrefix: `Competencia: ${params.race.name}`,
        },
      ],
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
