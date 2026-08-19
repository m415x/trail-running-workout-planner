/**
 * @file Estructuras temporales: Macrociclo, Mesociclo y Microciclo.
 */
import { BaseEntity, AthleteGroupCode } from '@/types'

export type MicrocycleType = 'base' | 'development' | 'shock' | 'deload' | 'tapering' | 'race'
export type PeriodType = 'general_preparatory' | 'specific_preparatory' | 'competitive' | 'transition'

export interface GroupVolumeProgression {
  range: {
    min: number
    max: number
  }
  volumes: Record<Extract<MicrocycleType, 'base' | 'development' | 'shock' | 'deload'>, number>
}

export interface Microcycle extends BaseEntity {
  mesocycleId: string
  weekNumber: number
  type: MicrocycleType
  startDate: string // 'YYYY-MM-DD'
  endDate: string // 'YYYY-MM-DD'
  targetVolumeKmByGroup: Partial<Record<AthleteGroupCode, number>>
  notes?: string
}

export interface Mesocycle extends BaseEntity {
  macrocycleId: string
  title: string
  number: number
  period: PeriodType
  objective: string
  microcycles?: Microcycle[]
}

export interface Macrocycle extends BaseEntity {
  teamId: string
  title: string
  targetRaceName: string
  targetRaceDate: string // 'YYYY-MM-DD'
  startDate: string
  endDate: string
  taperingWeeksCount: 2 | 3
  mesocycles?: Mesocycle[]
}
