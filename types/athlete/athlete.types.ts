/**
 * @file Modelos de atletas, grupos y equipo deportivo.
 */
import { BaseEntity } from '@/types/core/core.types'

export type AthleteCategoryCode = 'E' | 'U' | 'M' | 'H' | 'S' | 'B'
export type AthleteLevelCode = '1' | '2' | '3'
export type AthleteGroupCode = `${AthleteCategoryCode}${AthleteLevelCode}`
export type userRole = 'athlete' | 'coach' | 'admin'

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
  testType?: '1000m_track' | 'ramp_test' | 'cooper' | 'field_trial'
  notes?: string // Ej: "Test en pista de atletismo, condiciones ideales"
}

/**
 * 2. Registro histórico de transiciones de grupo dentro del equipo
 */
export interface GroupHistoryRecord extends BaseEntity {
  userId: string
  date: string // Fecha del cambio 'YYYY-MM-DD'
  previousGroup?: AthleteGroupCode
  newGroup: AthleteGroupCode
  promotedByUserId?: string // ID del entrenador que autorizó el cambio
  reason?: string // Ej: "Mejora sustancial en test PAM de junio y volumen asimilado"
}

/**
 * 3. Fisiología Actual (Valores vigentes calculados del último snapshot)
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
 * 4. Datos Médicos y Administrativos
 */
export interface MedicalRecord {
  certificateUrl?: string
  issuanceDate?: string
  expirationDate?: string
  bloodType?: string
  observations?: string
}

/**
 * 5. Entidad Principal de Usuario / Atleta
 */
export interface User extends BaseEntity {
  role: userRole
  teamId?: string
  email: string
  firstName: string
  lastName: string
  nickName?: string
  dni: string
  birthday?: string
  avatar?: string

  phone?: string
  emergencyContact?: string
  emergencyPhone?: string

  // Estado Actual Vigente
  group: AthleteGroupCode
  physiology?: AthletePhysiology
  medical?: MedicalRecord

  // Históricos (Colecciones embebidas o referenciadas)
  physiologyHistory?: PhysiologyRecord[]
  groupHistory?: GroupHistoryRecord[]
}
