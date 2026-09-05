export interface MesocycleLoadTarget {
  mesocycleNumber: number
  targetPeakVolumeKm: number
}

export interface MesocycleLoadTargetParams {
  initialWeeklyVolumeKm: number
  maximumWeeklyVolumeKm: number
  mesocycleCount: number
}

export function calculateMesocycleLoadTargets({
  initialWeeklyVolumeKm,
  maximumWeeklyVolumeKm,
  mesocycleCount,
}: MesocycleLoadTargetParams): MesocycleLoadTarget[] {
  if (!Number.isFinite(initialWeeklyVolumeKm) || initialWeeklyVolumeKm <= 0) {
    throw new Error('El volumen semanal inicial debe ser mayor que cero.')
  }

  if (!Number.isFinite(maximumWeeklyVolumeKm) || maximumWeeklyVolumeKm <= 0) {
    throw new Error('El volumen semanal máximo debe ser mayor que cero.')
  }

  if (initialWeeklyVolumeKm > maximumWeeklyVolumeKm) {
    throw new Error('El volumen semanal inicial no puede superar al máximo.')
  }

  if (!Number.isInteger(mesocycleCount) || mesocycleCount < 1) {
    throw new Error('La cantidad de mesociclos debe ser un entero mayor que cero.')
  }

  const availableIncrease = maximumWeeklyVolumeKm - initialWeeklyVolumeKm

  return Array.from({ length: mesocycleCount }, (_, index) => ({
    mesocycleNumber: index + 1,
    targetPeakVolumeKm: Math.round(
      initialWeeklyVolumeKm + availableIncrease * ((index + 1) / mesocycleCount),
    ),
  }))
}
