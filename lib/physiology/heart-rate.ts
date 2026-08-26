import { IntensityZone } from '@/types'
import { HR_ZONES } from '@/lib/constants'

export interface AthleteHeartRateParams {
  maxHr: number // Frecuencia Cardíaca Máxima (ej: 185 bpm)
  restHr?: number // Frecuencia Cardíaca Basal / en reposo (ej: 48 bpm)
}

/**
 * Calcula la FC objetivo para un porcentaje específico usando la fórmula de Karvonen
 * Si no se proporciona `restHr`, aplica el porcentaje plano sobre `maxHr`.
 */
export function calculateKarvonenBpm(
  intensityPct: number, // Valor entre 0 y 1 (ej: 0.65 para 65%)
  maxHr: number,
  restHr: number = 50,
): number {
  if (restHr <= 0 || restHr >= maxHr) {
    return Math.round(maxHr * intensityPct)
  }
  const heartRateReserve = maxHr - restHr
  return Math.round(restHr + heartRateReserve * intensityPct)
}

/**
 * Parsea el rango de porcentaje de la zona (ej: "60-70%") y devuelve los BPM exactos
 */
export function getZoneBpmRange(
  zone: IntensityZone,
  { maxHr = 190, restHr = 50 }: AthleteHeartRateParams,
): { minBpm: number; maxBpm: number } {
  const zoneInfo = HR_ZONES[zone] ?? HR_ZONES.Z1
  const [minPctStr, maxPctStr] = zoneInfo.pct.replace(/%/g, '').split('-')

  const minPct = Number(minPctStr) / 100
  const maxPct = Number(maxPctStr) / 100

  const minBpm = calculateKarvonenBpm(minPct, maxHr, restHr)
  const maxBpm = calculateKarvonenBpm(maxPct, maxHr, restHr)

  return {
    minBpm,
    maxBpm,
  }
}
