import type { BaseEntity } from '@/types/core/base.types'
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
