import { TrackData } from '@/types/route/track.types'
import { WorkoutProps } from '@/types/training/workout.types'

export interface WorkoutCardProps {
  workout: WorkoutProps
  date?: string
  TrackData?: TrackData | null
}
