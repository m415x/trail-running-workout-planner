import type { BaseEntity } from '@/types/core/base.types'
import type { IntensityZone } from '@/types/training/intensity.types'
import type { TrainingVolume } from '@/types/training/volume.types'
import type { WorkoutType } from '@/types/training/workout.types'

export interface Session extends BaseEntity {
  teamId: string
  workoutId?: string | null
  date: string
  title: string
  type: WorkoutType
  locationKey?: string | null
  trackPath?: string | null
  notes?: string | null
}

export interface GroupSessionPrescription extends BaseEntity, TrainingVolume {
  sessionId: string
  groupId: string
  microcycleId: string
  zone?: IntensityZone | null
  notes?: string | null
}
