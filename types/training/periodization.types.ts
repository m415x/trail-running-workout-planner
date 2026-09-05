/**
 * @file Estructuras temporales: Macrociclo, Mesociclo, Microciclo y Sesión.
 */
import { BaseEntity } from '@/types/core/base.types'
import { AthleteGroupCode } from '@/types/athlete/group.types'
import { TrainingGoalType } from '@/types/athlete/athlete.types'
import type { Session } from '@/types/training/session.types'

export type VolumeMatrixMicrocycleType = 'base' | 'development' | 'shock' | 'deload'
export type MicrocycleType = VolumeMatrixMicrocycleType | 'tapering' | 'race'
export type PeriodType = 'general_preparatory' | 'specific_preparatory' | 'competitive' | 'transition'
export type GroupTrainingPlanStatus = 'draft' | 'active' | 'completed' | 'cancelled'
export type ProgressionDurationProfile = 'short' | 'normal' | 'long'
export type TargetValueSource = 'generated' | 'manual'
export type TargetVolumeSource = TargetValueSource
export type TargetElevationSource = TargetValueSource
export type MicrocycleLoadFocus = 'balanced' | 'volume' | 'elevation' | 'recovery' | 'race_specific'
export type PlanningModificationField =
  | 'target_volume_km'
  | 'target_elevation_gain'
  | 'date_range'
  | 'type'
  | 'notes'
  | 'load_initial_weekly_volume_km'
  | 'load_maximum_weekly_volume_km'
  | 'load_sessions_per_week'
  | 'load_maximum_weekly_increase_percentage'
  | 'load_deload_percentage'
  | 'load_initial_weekly_elevation_gain'
  | 'load_maximum_weekly_elevation_gain'

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
  loadFocus: MicrocycleLoadFocus
  startDate: string
  endDate: string
  targetVolumeKm: number
  targetVolumeSource: TargetVolumeSource
  targetElevationGain: number | null
  targetElevationSource: TargetElevationSource
  notes: string
}

/**
 * Immutable race context copied into a group macrocycle.
 *
 * This is not a link to an athlete's individual TrainingGoal. Distance is
 * expressed in kilometers and elevation gain in positive meters (m+).
 */
export interface TargetRaceSnapshot {
  name: string
  distanceKm: number
  elevationGain?: number
}

export interface GeneratedMesocycleDraft {
  title: string
  number: number
  period: PeriodType
  objective: string
  targetPeakVolumeKm?: number
  targetPeakElevationGain?: number | null
  microcycles: GeneratedMicrocycleDraft[]
}

export interface GeneratedMacrocycleDraft {
  title: string
  goalType: TrainingGoalType
  athleteGroup: AthleteGroupCode
  startDate: string
  endDate: string
  taperingWeeksCount: 0 | 2 | 3
  trainingWeeksCount: number
  progressionDurationProfile: ProgressionDurationProfile
  race: TargetRaceSnapshot | null
  generationWarnings: string[]
  mesocycles: GeneratedMesocycleDraft[]
}

export interface Microcycle extends BaseEntity {
  mesocycleId: string
  weekNumber: number
  type: MicrocycleType
  loadFocus?: MicrocycleLoadFocus | null
  startDate: string // 'YYYY-MM-DD'
  endDate: string // 'YYYY-MM-DD'
  targetVolumeKm?: number | null
  targetVolumeSource: TargetVolumeSource
  targetElevationGain?: number | null
  targetElevationSource: TargetElevationSource
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
  targetRaceName?: string | null
  targetRaceDistanceKm?: number | null
  targetRaceElevationGain?: number | null
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
