import { BaseEntity } from '@/types/core/base.types'

export type TestType = '1000m_track' | 'ramp_test' | 'cooper' | 'field_trial'

/**
 * 1. Registro histórico de evaluaciones y biometría (Snapshots periódicos)
 */
export interface PhysiologyRecord extends BaseEntity {
  userId: string
  date: string // 'YYYY-MM-DD'

  // Test PAM / 1000m
  pamTimeSec: number // Tiempo en segundos (ej: 215 = 3:35 min)
  pamPaceFormatted: string // '3:35/km'
  pamSpeedKmh?: number // Calculado: 16.74 km/h

  // Métricas Cardíacas
  maxHr: number // FC Máxima registrada en el test (bpm)
  restHr: number // FC Basal/reposo actual (bpm)
  thresholdHr?: number // FC Umbral (bpm)

  // Composición corporal
  weightKg?: number // Peso en kg (ej: 68.5)
  heightCm?: number // Altura en cm (ej: 175)

  // Notas del entrenador o test
  testType?: TestType
  notes?: string // Ej: "Test en pista de atletismo, condiciones ideales"
}

/**
 * 2. Fisiología Actual (Valores vigentes calculados del último snapshot)
 */
export interface AthletePhysiology {
  maxHr: number
  restHr: number
  thresholdHr?: number
  currentPamTimeSec: number
  currentPamPace: string
  weightKg?: number
  lastEvaluationDate: string
}

/**
 * 3. Datos Médicos y Administrativos
 */
export interface MedicalRecord {
  certificateUrl?: string
  issuanceDate?: string
  expirationDate?: string
  bloodType?: string
  observations?: string
}
