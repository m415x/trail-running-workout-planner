/**
 * @file Estructuras temporales: Macrociclo, Mesociclo, Microciclo y Sesión.
 */
import { AthleteGroupCode } from '@/types/athlete/athlete.types'
import { BaseEntity, IntensityZone } from '@/types/core/base.types'

export type DayType = 'Workout' | 'Race' | 'Rest'
export type VolumeMatrixMicrocycleType = 'base' | 'development' | 'shock' | 'deload'
export type MicrocycleType = VolumeMatrixMicrocycleType | 'tapering' | 'race'
export type PeriodType = 'general_preparatory' | 'specific_preparatory' | 'competitive' | 'transition'

export interface GroupVolumeOverride {
  distanceKm: number
  durationMin?: number
  notes?: string
}

export interface IntervalPrescription {
  repetitions: number
  distanceMeters: number
}

export interface GroupVolumeProgression {
  range: { min: number; max: number }
  volumes: Record<VolumeMatrixMicrocycleType, number>
}

export interface Session extends BaseEntity {
  microcycleId: string
  date: string // 'YYYY-MM-DD'
  title: string
  type: DayType
  zone: IntensityZone
  locationKey?: string
  trackPath?: string
  structure?: {
    warmup: string
    mainBlock: string
    cooldown: string
  }
  defaultVolume: {
    km: number
    timeMin: number
  }
  groupOverrides?: Partial<Record<AthleteGroupCode, GroupVolumeOverride>>
  notes?: string
}

export interface Microcycle extends BaseEntity {
  mesocycleId: string
  weekNumber: number
  type: MicrocycleType
  startDate: string // 'YYYY-MM-DD'
  endDate: string // 'YYYY-MM-DD'
  targetVolumeKmByGroup: Partial<Record<AthleteGroupCode, number>>
  notes?: string
  sessions?: Session[]
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
  group: AthleteGroupCode
  title: string
  targetRaceName: string
  targetRaceDate: string // 'YYYY-MM-DD'
  startDate: string
  endDate: string
  taperingWeeksCount: 2 | 3
  mesocycles?: Mesocycle[]
}
