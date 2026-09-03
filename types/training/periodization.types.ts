/**
 * @file Estructuras temporales: Macrociclo, Mesociclo, Microciclo y Sesión.
 */
import { BaseEntity } from '@/types/core/base.types'
import { AthleteGroupCode } from '@/types/athlete/group.types'
import { TrainingGoalType } from '@/types/athlete/athlete.types'
import { IntensityZone } from '@/types/training/intensity.types'
import { WorkoutType } from '@/types/training/workout.types'

export type VolumeMatrixMicrocycleType = 'base' | 'development' | 'shock' | 'deload'
export type MicrocycleType = VolumeMatrixMicrocycleType | 'tapering' | 'race'
export type PeriodType = 'general_preparatory' | 'specific_preparatory' | 'competitive' | 'transition'
export type GroupTrainingPlanStatus = 'draft' | 'active' | 'completed' | 'cancelled'
export type PlanningModificationField = 'target_volume_km' | 'date_range' | 'type' | 'notes'

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

export interface GeneratedMicrocycleDraft {
  weekNumber: number
  type: MicrocycleType
  startDate: string
  endDate: string
  targetVolumeKm: number
  targetElevationGain: number
  notes: string
}

export interface GeneratedMesocycleDraft {
  title: string
  number: number
  period: PeriodType
  objective: string
  microcycles: GeneratedMicrocycleDraft[]
}

export interface GeneratedMacrocycleDraft {
  title: string
  goalType: TrainingGoalType
  athleteGroup: AthleteGroupCode
  startDate: string
  endDate: string
  taperingWeeksCount: 0 | 2 | 3
  race: {
    name: string
    distanceKm: number
    elevationGain?: number
  } | null
  mesocycles: GeneratedMesocycleDraft[]
}

export interface SessionStructure {
  preliminaryExercises?: string
  warmup: string
  mainBlock: string
  cooldown: string
}

export interface Session extends BaseEntity {
  microcycleId: string
  date: string // 'YYYY-MM-DD'
  title: string
  type: WorkoutType
  zone: IntensityZone
  locationKey?: string
  trackPath?: string
  structure?: SessionStructure
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
  targetVolumeKm?: number | null
  targetElevationGain?: number | null
  targetDurationMin?: number | null
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
  groupTrainingPlanId: string
  title: string
  startDate: string
  endDate: string
  taperingWeeksCount?: 0 | 2 | 3 | null
  notes?: string | null
  mesocycles?: Mesocycle[]
}

export interface GroupTrainingPlan extends BaseEntity {
  groupId: string
  title: string
  status: GroupTrainingPlanStatus
  notes?: string | null
  macrocycles?: Macrocycle[]
}

export interface PlanningModificationRecord extends BaseEntity {
  groupTrainingPlanId: string
  microcycleId: string | null
  field: PlanningModificationField
  previousValue?: string | null
  newValue?: string | null
  changedByUserId?: string | null
}
