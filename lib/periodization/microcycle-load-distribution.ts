import type { VolumeMatrixMicrocycleType } from '@/types'

export interface DistributedMicrocycleLoad {
  type: VolumeMatrixMicrocycleType
  targetVolumeKm: number
}

export interface MicrocycleLoadDistributionParams {
  sequence: VolumeMatrixMicrocycleType[]
  startingVolumeKm: number
  targetPeakVolumeKm: number
  deloadPercentage: number
  maximumWeeklyIncreasePercentage: number
}

export function distributeMesocycleLoad({
  sequence,
  startingVolumeKm,
  targetPeakVolumeKm,
  deloadPercentage,
  maximumWeeklyIncreasePercentage,
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

  if (
    !Number.isFinite(deloadPercentage)
    || deloadPercentage <= 0
    || deloadPercentage >= 100
  ) {
    throw new Error('El porcentaje de descarga debe ser mayor que cero y menor que 100.')
  }

  if (
    !Number.isFinite(maximumWeeklyIncreasePercentage)
    || maximumWeeklyIncreasePercentage <= 0
  ) {
    throw new Error('El incremento semanal máximo debe ser mayor que cero.')
  }

  const loadingWeeksCount = sequence.filter((type) => type !== 'deload').length

  if (loadingWeeksCount === 0) {
    throw new Error('El mesociclo debe incluir al menos una semana de carga.')
  }

  let loadingWeekIndex = 0
  let lastToleratedVolumeKm = startingVolumeKm

  return sequence.map((type) => {
    if (type === 'deload') {
      return {
        type,
        targetVolumeKm: Math.round(
          lastToleratedVolumeKm * (1 - deloadPercentage / 100),
        ),
      }
    }

    const progress = loadingWeeksCount === 1
      ? 0
      : loadingWeekIndex / (loadingWeeksCount - 1)
    const proposedVolumeKm = Math.round(
      startingVolumeKm + (targetPeakVolumeKm - startingVolumeKm) * progress,
    )
    const maximumAllowedVolumeKm = Math.floor(
      lastToleratedVolumeKm * (1 + maximumWeeklyIncreasePercentage / 100),
    )
    const targetVolumeKm = loadingWeekIndex === 0
      ? startingVolumeKm
      : Math.min(proposedVolumeKm, maximumAllowedVolumeKm, targetPeakVolumeKm)
    loadingWeekIndex += 1
    lastToleratedVolumeKm = targetVolumeKm

    return { type, targetVolumeKm }
  })
}
