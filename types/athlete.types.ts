/**
 * @file Modelos de atletas, grupos y equipo deportivo.
 */
import { BaseEntity } from '@/types'

export type AthleteCategoryCode = 'E' | 'U' | 'M' | 'H' | 'S' | 'B'
export type AthleteLevelCode = '1' | '2' | '3'

// Genera 'E1' | 'E2' | ... | 'B3'
export type AthleteGroupCode = `${AthleteCategoryCode}${AthleteLevelCode}`

export interface CategoryMetadata {
  name: string
  code: AthleteCategoryCode
  description: string
}

export interface LevelMetadata {
  name: string
  code: AthleteLevelCode
  description: string
}

export interface Team extends BaseEntity {
  name: string
  description?: string
  avatar?: string
}

export interface User extends BaseEntity {
  teamId?: string
  firstName: string
  lastName: string
  nickName?: string
  dni: string
  birthday?: string
  email: string
  phone?: string
  emergencyContact?: string
  emergencyPhone?: string
  avatar?: string
  group: AthleteGroupCode
  medicalCertificate?: string
  certificateIssuanceDate?: string
  certificateExpirationDate?: string
  role: 'athlete' | 'coach' | 'admin'
}
