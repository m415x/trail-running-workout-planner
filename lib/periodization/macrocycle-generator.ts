import { addWeeks, differenceInCalendarWeeks, format, parseISO, subWeeks } from 'date-fns'
import {
  AthleteCategoryCode,
  AthleteGroupCode,
  Macrocycle,
  Mesocycle,
  Microcycle,
  MicrocycleType,
  VolumeMatrixMicrocycleType,
  TSB_TARGETS_BY_MICROCYCLE,
} from '@/types'
import { GROUP_VOLUME_MATRIX } from '@/data/periodization-matrix'

// Secuencia fractal estándar de 4 semanas
const STANDARD_MESOCYCLE_SEQUENCE: VolumeMatrixMicrocycleType[] = ['base', 'development', 'shock', 'deload']

// Multiplicador de Desnivel D+ estimado por km según nivel del grupo (metros D+ por cada km de volumen)
const ELEVATION_RATIO_BY_GROUP_PREFIX: Record<AthleteCategoryCode, number> = {
  E: 35, // Elite: ~35m D+ por cada km
  U: 45, // Ultra: ~45m D+ por cada km
  M: 30, // Marathon: ~30m D+ por cada km
  H: 25, // Half: ~25m D+ por cada km
  S: 20, // Short: ~20m D+ por cada km
  B: 15, // Base: ~15m D+ por cada km
}

export interface MacrocycleGeneratorParams {
  title: string
  targetRaceName: string
  targetRaceDate: string // 'YYYY-MM-DD'
  startDate: string // 'YYYY-MM-DD'
  targetRaceDistanceKm: number
  athleteGroup: AthleteGroupCode
}

export function generateFractalMacrocycle({
  title,
  targetRaceName,
  targetRaceDate,
  startDate,
  targetRaceDistanceKm,
  athleteGroup,
}: MacrocycleGeneratorParams): Macrocycle {
  const start = parseISO(startDate)
  const raceDate = parseISO(targetRaceDate)

  const totalWeeks = differenceInCalendarWeeks(raceDate, start)
  if (totalWeeks < 4) {
    throw new Error('El macrociclo debe tener al menos 4 semanas de planificación.')
  }

  // 1. Determinar semanas de Tapering según distancia y volumen del grupo
  const taperingWeeksCount: 2 | 3 =
    targetRaceDistanceKm >= 42 || athleteGroup.startsWith('E') || athleteGroup.startsWith('U') ? 3 : 2

  const trainingWeeksCount = totalWeeks - taperingWeeksCount
  const baseVolumeProgression = GROUP_VOLUME_MATRIX[athleteGroup]
  const athleteCategory = athleteGroup.substring(0, 1) as AthleteCategoryCode
  const dPlusRatio = ELEVATION_RATIO_BY_GROUP_PREFIX[athleteCategory] ?? 25

  const mesocycles: Mesocycle[] = []
  let currentWeekStart = start
  let globalWeekCounter = 1

  // 2. Construir los Mesociclos de Entrenamiento (Bloques fractales de hasta 4 semanas)
  const numberOfMesos = Math.ceil(trainingWeeksCount / 4)

  for (let mesoIdx = 0; mesoIdx < numberOfMesos; mesoIdx++) {
    const weeksInThisMeso = Math.min(4, trainingWeeksCount - mesoIdx * 4)
    const microcycles: Microcycle[] = []

    for (let microIdx = 0; microIdx < weeksInThisMeso; microIdx++) {
      const type = STANDARD_MESOCYCLE_SEQUENCE[microIdx]
      const weekEnd = addWeeks(currentWeekStart, 1)

      // Cálculo de volumen adaptado
      const targetKm = baseVolumeProgression.volumes[type]
      const targetDPlus = Math.round(targetKm * dPlusRatio)

      microcycles.push({
        id: `micro-${globalWeekCounter}`,
        mesocycleId: `meso-${mesoIdx + 1}`,
        weekNumber: globalWeekCounter,
        type,
        startDate: format(currentWeekStart, 'yyyy-MM-dd'),
        endDate: format(weekEnd, 'yyyy-MM-dd'),
        targetVolumeKmByGroup: { [athleteGroup]: targetKm },
        notes: `Objetivo: ${targetKm} km | +${targetDPlus}m D+ | TSB esperado: [${TSB_TARGETS_BY_MICROCYCLE[type].min} a ${TSB_TARGETS_BY_MICROCYCLE[type].max}]`,
      })

      currentWeekStart = weekEnd
      globalWeekCounter++
    }

    mesocycles.push({
      id: `meso-${mesoIdx + 1}`,
      macrocycleId: 'macro-1',
      title: `Mesociclo ${mesoIdx + 1}: ${mesoIdx === numberOfMesos - 1 ? 'Pico y Especificidad' : 'Desarrollo y Carga'}`,
      number: mesoIdx + 1,
      period: mesoIdx === 0 ? 'general_preparatory' : 'specific_preparatory',
      objective: `Bloque de ondulación fractal (${weeksInThisMeso} semanas)`,
      microcycles,
    })
  }

  // 3. Mesociclo Final de Tapering y Competición (Ruptura del patrón fractal)
  const taperingMicrocycles: Microcycle[] = []
  const peakVolume = baseVolumeProgression.volumes.shock

  for (let tapIdx = 0; tapIdx < taperingWeeksCount; tapIdx++) {
    const isRaceWeek = tapIdx === taperingWeeksCount - 1
    const type: MicrocycleType = isRaceWeek ? 'race' : 'tapering'
    const weekEnd = addWeeks(currentWeekStart, 1)

    // Reducción progresiva de volumen (60% en sem -2, 40% en semana de carrera + carrera)
    const volumeFactor = isRaceWeek ? 0.35 : 0.6
    const targetKmTapering = Math.round(peakVolume * volumeFactor) + (isRaceWeek ? targetRaceDistanceKm : 0)
    const targetDPlus = Math.round(targetKmTapering * (dPlusRatio * 0.7))

    taperingMicrocycles.push({
      id: `micro-${globalWeekCounter}`,
      mesocycleId: `meso-tapering`,
      weekNumber: globalWeekCounter,
      type,
      startDate: format(currentWeekStart, 'yyyy-MM-dd'),
      endDate: format(weekEnd, 'yyyy-MM-dd'),
      targetVolumeKmByGroup: { [athleteGroup]: targetKmTapering },
      notes: isRaceWeek
        ? `Competencia: ${targetRaceName}. Objetivo: ${targetKmTapering} km | +${targetDPlus}m D+. TSB: [${TSB_TARGETS_BY_MICROCYCLE[type].min} a ${TSB_TARGETS_BY_MICROCYCLE[type].max}]`
        : `Tapering: Reducción al ${Math.round(volumeFactor * 100)}%. Objetivo: ${targetKmTapering} km | +${targetDPlus}m D+. TSB: [${TSB_TARGETS_BY_MICROCYCLE[type].min} a ${TSB_TARGETS_BY_MICROCYCLE[type].max}]`,
    })

    currentWeekStart = weekEnd
    globalWeekCounter++
  }

  mesocycles.push({
    id: 'meso-tapering',
    macrocycleId: 'macro-1',
    title: 'Mesociclo Competitivo: Tapering y Carrera',
    number: numberOfMesos + 1,
    period: 'competitive',
    objective: 'Afinamiento, supercompensación y pico de rendimiento',
    microcycles: taperingMicrocycles,
  })

  return {
    id: 'macro-1',
    group: 'S2',
    title,
    targetRaceName,
    targetRaceDate,
    startDate,
    endDate: format(subWeeks(currentWeekStart, 0), 'yyyy-MM-dd'),
    taperingWeeksCount,
    mesocycles,
  }
}
