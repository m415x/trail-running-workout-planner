import { IntensityZone } from '@/types'
import { ZONE_PAM_PERCENTAGES } from '@/lib/constants'

/**
 * Convierte segundos a formato min:seg (ej: 340 -> "5:40")
 */
export function formatPaceFromSeconds(seconds: number): string {
  if (seconds <= 0 || !Number.isFinite(seconds)) return '0:00'

  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)

  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Calcula la velocidad PAM en km/h a partir del tiempo en los 1000m
 */
export function calculatePamSpeed(secondsFor1000m: number): number {
  if (secondsFor1000m <= 0) return 0
  const speed = 3600 / secondsFor1000m

  return Number(speed.toFixed(2))
}

/**
 * Calcula el ritmo objetivo para un porcentaje específico de PAM (ej: 110% PAM para pasadas)
 */
export function calculatePaceAtPamPercentage(
  pamSecondsFor1000m: number,
  percentage: number, // ej: 1.10 para 110%
): { paceSeconds: number; paceLabel: string } {
  // A mayor porcentaje PAM, menor tiempo por km (mayor velocidad)
  const targetSeconds = pamSecondsFor1000m / percentage

  return {
    paceSeconds: Math.round(targetSeconds),
    paceLabel: formatPaceFromSeconds(targetSeconds),
  }
}

/**
 * Convierte un ritmo min:seg o decimal a segundos por km (ej: "4:00" -> 240)
 */
export function parsePaceToSeconds(pace: string | number): number {
  if (typeof pace === 'number') return pace

  if (!pace || !pace.includes(':')) return 0
  const [min, sec] = pace.replace('/km', '').trim().split(':').map(Number)

  return min * 60 + (sec || 0)
}

/**
 * Convierte un ritmo en segundos/km a velocidad en km/h
 */
export function secondsToSpeed(secondsPerKm: number): number {
  if (secondsPerKm <= 0) return 0

  return Number((3600 / secondsPerKm).toFixed(1))
}

/**
 * Calcula el rango de tiempo estimado (en minutos) según la distancia (km)
 * y los ritmos mínimo y máximo en segundos
 */
export function calculateEstimatedTimeRange(distanceKm: number, minPaceSec: number, maxPaceSec: number): string {
  if (distanceKm <= 0) return '0'

  const minTotalMin = Math.round((distanceKm * minPaceSec) / 60)
  const maxTotalMin = Math.round((distanceKm * maxPaceSec) / 60)

  return `${minTotalMin} - ${maxTotalMin}`
}

/**
 * Calcula el rango de velocidad (km/h) a partir de los ritmos en segundos
 */
export function calculateSpeedRange(minPaceSec: number, maxPaceSec: number): string {
  // A ritmo más rápido (menor tiempo), mayor velocidad
  const maxSpeed = secondsToSpeed(minPaceSec)
  const minSpeed = secondsToSpeed(maxPaceSec)

  return `${minSpeed} - ${maxSpeed}`
}

export interface ZonePaceRangeFromPam {
  minPaceSec: number
  maxPaceSec: number
  paceRangeLabel: string
  speedRangeLabel: string
  timeRangeLabel: string | null
}
/**
 * Calcula el rango de ritmo estimado (min/km) para una zona cardíaca específica
 */
export function getZonePaceRangeFromPam(
  zone: IntensityZone,
  pamTimeSec?: number,
  distanceKm?: number,
): ZonePaceRangeFromPam | null {
  if (!pamTimeSec || pamTimeSec <= 0) return null

  const config = ZONE_PAM_PERCENTAGES[zone]
  if (!config) return null

  const fasterSeconds = Math.round(pamTimeSec / config.maxPct)
  const slowerSeconds = Math.round(pamTimeSec / config.minPct)

  const fasterStr = formatPaceFromSeconds(fasterSeconds)
  const slowerStr = formatPaceFromSeconds(slowerSeconds)

  return {
    minPaceSec: fasterSeconds,
    maxPaceSec: slowerSeconds,
    paceRangeLabel: `${fasterStr} - ${slowerStr}`,
    speedRangeLabel: calculateSpeedRange(fasterSeconds, slowerSeconds),
    timeRangeLabel: distanceKm ? calculateEstimatedTimeRange(distanceKm, fasterSeconds, slowerSeconds) : null,
  }
}
