import type { VolumeMatrixMicrocycleType } from '@/types'

export interface DistributedMicrocycleLoad {
  type: VolumeMatrixMicrocycleType
  targetVolumeKm: number
}

export interface MicrocycleLoadDistributionParams {
  sequence: VolumeMatrixMicrocycleType[]
  startingVolumeKm: number
  targetPeakVolumeKm: number
}

function roundToOneDecimal(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10
}

export function distributeMesocycleLoad({
  sequence,
  startingVolumeKm,
  targetPeakVolumeKm,
}: MicrocycleLoadDistributionParams): DistributedMicrocycleLoad[] {
  if (sequence.length === 0) {
    throw new Error('Se necesita al menos un microciclo para distribuir la carga.')
  }

  if (!Number.isFinite(startingVolumeKm) || startingVolumeKm <= 0) {
    throw new Error('El volumen inicial del mesociclo debe ser mayor que cero.')
  }

  if (!Number.isFinite(targetPeakVolumeKm) || targetPeakVolumeKm < startingVolumeKm) {
    throw new Error('El pico del mesociclo debe ser igual o superior al volumen inicial.')
  }

  const loadingWeeksCount = sequence.filter((type) => type !== 'deload').length

  if (loadingWeeksCount === 0) {
    throw new Error('El mesociclo debe incluir al menos una semana de carga.')
  }

  let loadingWeekIndex = 0

  return sequence.map((type) => {
    if (type === 'deload') {
      return { type, targetVolumeKm: startingVolumeKm }
    }

    const progress = loadingWeeksCount === 1
      ? 1
      : loadingWeekIndex / (loadingWeeksCount - 1)
    const targetVolumeKm = roundToOneDecimal(
      startingVolumeKm + (targetPeakVolumeKm - startingVolumeKm) * progress,
    )
    loadingWeekIndex += 1

    return { type, targetVolumeKm }
  })
}
