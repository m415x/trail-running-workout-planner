import { MicrocycleType } from '@/types/periodization.types'

/**
 * Rangos teóricos de TSB esperados según la fase del microciclo
 */
export interface TsbRangeTarget {
  min: number
  max: number
  description: string
}

export const TSB_TARGETS_BY_MICROCYCLE: Record<MicrocycleType, TsbRangeTarget> = {
  base: { min: -10, max: 5, description: 'Zona de adaptación y base aeróbica' },
  development: { min: -25, max: -10, description: 'Zona de entrenamiento óptimo' },
  shock: { min: -40, max: -25, description: 'Sobrecarga funcional controlada' },
  deload: { min: 5, max: 15, description: 'Asimilación y supercompensación' },
  tapering: { min: 15, max: 25, description: 'Zona de frescura para competir' },
  race: { min: 10, max: 25, description: 'Pico de rendimiento' },
}

/**
 * Parámetros para el cálculo del TSS (Training Stress Score) diario.
 */
export interface CalculateDailyTssParams {
  durationMin: number
  rpe: number // 1 a 10
  elevationGainM?: number
}

/**
 * Snapshot de carga diaria o semanal calculada (Banister / Coggan)
 */
export interface DailyStressMetrics {
  date: string // 'YYYY-MM-DD'
  tss: number // Training Stress Score diario
  ctl: number // Chronic Training Load (Forma - EMA 42 días)
  atl: number // Acute Training Load (Fatiga - EMA 7 días)
  tsb: number // Training Stress Balance (CTL - ATL)
}

/**
 * Métricas de volumen y desnivel calculadas para un microciclo
 */
export interface MicrocycleVolumeTarget {
  volumeKm: number
  elevationGainM: number // Desnivel positivo D+ acumulado
  loadPercentage: number // % de la carga pico (ej: 0.70 a 1.00)
  projectedTsb: TsbRangeTarget
}
