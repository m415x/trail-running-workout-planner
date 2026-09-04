import { addDays, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'

import { GROUP_ELEVATION_METERS_PER_KM } from '@/data/periodization-matrix'
import { calculateTargetVolume } from '@/lib/periodization/target-volume-calculator'
import { validateLoadStrategy } from '@/lib/periodization/load-strategy-validator'
import { calculateMesocycleLoadTargets } from '@/lib/periodization/mesocycle-load-targets'
import { distributeMesocycleLoad } from '@/lib/periodization/microcycle-load-distribution'
import { TSB_TARGETS_BY_MICROCYCLE } from '@/types'

import type {
  AthleteGroupCode,
  GeneratedMacrocycleDraft,
  GeneratedMesocycleDraft,
  GeneratedMicrocycleDraft,
  LoadStrategyDraft,
  MicrocycleType,
  TrainingGoalType,
  VolumeMatrixMicrocycleType,
} from '@/types'

const STANDARD_MESOCYCLE_SEQUENCE: VolumeMatrixMicrocycleType[] = ['base', 'development', 'shock', 'deload']

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
  loadStrategy: LoadStrategyDraft
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

  if (params.loadStrategy.context.athleteGroup !== params.athleteGroup) {
    throw new Error('La estrategia de carga pertenece a otro grupo.')
  }

  if (params.loadStrategy.context.goalType !== params.goalType) {
    throw new Error('La estrategia de carga pertenece a otro tipo de objetivo.')
  }

  const strategyValidation = validateLoadStrategy(params.loadStrategy)

  if (!strategyValidation.isValid) {
    throw new Error(
      strategyValidation.errors[0]?.message ?? 'La estrategia de carga no es válida.',
    )
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

export function determineTaperingWeeksCount(
  group: AthleteGroupCode,
  race: OptionalTargetRace | undefined,
): 0 | 2 | 3 {
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
  loadStrategy: LoadStrategyDraft
}

export function generateTrainingMesocycles({
  startDate,
  endDate,
  trainingWeeksCount,
  athleteGroup,
  loadStrategy,
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

  const athleteCategory = athleteGroup.charAt(0) as keyof typeof GROUP_ELEVATION_METERS_PER_KM
  const elevationRatio = GROUP_ELEVATION_METERS_PER_KM[athleteCategory]
  const weekDistribution = distributeWeeksIntoMesocycles(trainingWeeksCount)
  const mesocycleLoadTargets = calculateMesocycleLoadTargets({
    initialWeeklyVolumeKm: loadStrategy.values.initialWeeklyVolumeKm,
    maximumWeeklyVolumeKm: loadStrategy.values.maximumWeeklyVolumeKm,
    mesocycleCount: weekDistribution.length,
  })
  const mesocycles: GeneratedMesocycleDraft[] = []
  let currentWeekStart = start
  let globalWeekCounter = 1
  let lastToleratedPeakVolumeKm = loadStrategy.values.initialWeeklyVolumeKm

  weekDistribution.forEach((weeksInMesocycle, mesocycleIndex) => {
    const microcycleSequence = getMicrocycleSequence(weeksInMesocycle)
    const mesocycleLoadTarget = mesocycleLoadTargets[mesocycleIndex]
    const distributedLoads = distributeMesocycleLoad({
      sequence: microcycleSequence,
      startingVolumeKm: lastToleratedPeakVolumeKm,
      targetPeakVolumeKm: mesocycleLoadTarget.targetPeakVolumeKm,
      deloadPercentage: loadStrategy.values.deloadPercentage,
      maximumWeeklyIncreasePercentage: loadStrategy.values.maximumWeeklyIncreasePercentage,
    })
    const achievedPeakVolumeKm = Math.max(
      ...distributedLoads
        .filter(({ type }) => type !== 'deload')
        .map(({ targetVolumeKm }) => targetVolumeKm),
    )
    lastToleratedPeakVolumeKm = achievedPeakVolumeKm
    const targets = distributedLoads.map(({ type, targetVolumeKm }): MicrocycleTarget => {
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
      targetPeakVolumeKm: achievedPeakVolumeKm,
      microcycles,
    })
  })

  return mesocycles
}

export interface CompetitiveMesocycleGeneratorParams {
  startDate: string
  endDate: string
  startWeekNumber: number
  mesocycleNumber: number
  athleteGroup: AthleteGroupCode
  race: OptionalTargetRace
  taperingWeeksCount: 2 | 3
}

export function generateCompetitiveMesocycle({
  startDate,
  endDate,
  startWeekNumber,
  mesocycleNumber,
  athleteGroup,
  race,
  taperingWeeksCount,
}: CompetitiveMesocycleGeneratorParams): GeneratedMesocycleDraft {
  if (!Number.isInteger(mesocycleNumber) || mesocycleNumber < 1) {
    throw new Error('mesocycleNumber debe ser un entero mayor que cero.')
  }

  const athleteCategory = athleteGroup.charAt(0) as keyof typeof GROUP_ELEVATION_METERS_PER_KM
  const elevationRatio = GROUP_ELEVATION_METERS_PER_KM[athleteCategory]
  const taperingFactors = taperingWeeksCount === 3 ? [0.6, 0.4] : [0.6]
  const taperingTargets = taperingFactors.map((volumeFactor): MicrocycleTarget => {
    const targetVolumeKm = calculateTargetVolume({
      athleteGroup,
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
    athleteGroup,
    type: 'race',
    raceDistanceKm: race.distanceKm,
  })
  const raceWeekElevationGain = race.elevationGain
    ?? Math.round(raceWeekVolumeKm * elevationRatio * 0.7)
  const microcycles = generateMicrocycles({
    startDate,
    endDate,
    startWeekNumber,
    targets: [
      ...taperingTargets,
      {
        type: 'race',
        targetVolumeKm: raceWeekVolumeKm,
        targetElevationGain: raceWeekElevationGain,
        notesPrefix: `Competencia: ${race.name}`,
      },
    ],
  })

  return {
    title: 'Mesociclo competitivo: tapering y carrera',
    number: mesocycleNumber,
    period: 'competitive',
    objective: 'Afinamiento, supercompensación y pico de rendimiento',
    microcycles,
  }
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

  const taperingWeeksCount = determineTaperingWeeksCount(params.athleteGroup, params.race)
  const trainingWeeksCount = totalWeeks - taperingWeeksCount

  if (trainingWeeksCount < 2) {
    throw new Error('El período disponible no alcanza para incluir entrenamiento y tapering.')
  }

  const mesocycles = generateTrainingMesocycles({
    startDate: params.startDate,
    endDate: params.endDate,
    trainingWeeksCount,
    athleteGroup: params.athleteGroup,
    loadStrategy: params.loadStrategy,
  })
  const currentWeekStart = addDays(start, trainingWeeksCount * 7)
  const globalWeekCounter = trainingWeeksCount + 1
  const numberOfTrainingMesocycles = mesocycles.length
  const finalTrainingPeakVolumeKm = mesocycles.at(-1)?.targetPeakVolumeKm
  const generationWarnings = finalTrainingPeakVolumeKm !== undefined
    && finalTrainingPeakVolumeKm < params.loadStrategy.values.maximumWeeklyVolumeKm
    ? [
        `El período disponible permite alcanzar ${finalTrainingPeakVolumeKm} km semanales, por debajo del máximo configurado de ${params.loadStrategy.values.maximumWeeklyVolumeKm} km.`,
      ]
    : []

  if (params.race) {
    if (taperingWeeksCount === 0) {
      throw new Error('No se pudo determinar el tapering para la carrera.')
    }

    mesocycles.push(generateCompetitiveMesocycle({
      startDate: format(currentWeekStart, 'yyyy-MM-dd'),
      endDate: params.endDate,
      startWeekNumber: globalWeekCounter,
      mesocycleNumber: numberOfTrainingMesocycles + 1,
      athleteGroup: params.athleteGroup,
      race: params.race,
      taperingWeeksCount,
    }))
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
    generationWarnings,
    mesocycles,
  }
}
