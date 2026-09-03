import type { BaseEntity } from '@/types/core/base.types'
import type { IntensityMethod, IntensityZone } from '@/types/training/intensity.types'
import type { TrainingVolume } from '@/types/training/volume.types'
import type { WorkoutType } from '@/types/training/workout.types'

export interface SessionStructure {
  preliminaryExercises?: string | null
  warmup?: string | null
  mainBlock?: string | null
  cooldown?: string | null
}

export interface Session extends BaseEntity {
  teamId: string
  workoutId?: string | null
  date: string
  title: string
  type: WorkoutType
  locationKey?: string | null
  trackPath?: string | null
  structure?: SessionStructure | null
  notes?: string | null
}

export interface GroupSessionPrescription extends BaseEntity, TrainingVolume {
  sessionId: string
  groupId: string
  microcycleId: string
  intensityMethod?: IntensityMethod | null
  zone?: IntensityZone | null
  pamPercentage?: number | null
  notes?: string | null
}
