import { TrackData } from '../route/track.types'
import { LoggedWorkoutPayload } from '../training/workout-log.types'
import { WorkoutProps } from '../training/workout.types'

export interface WorkoutCardProps {
  workout: WorkoutProps
  date?: string
  TrackData?: TrackData | null
}

export interface ElevationChartProps {
  workout: WorkoutProps
  elevData: { km: string; elev: number }[]
  elevMin: number
  elevMax: number
  yDomain: number[]
  xDomain?: string[]
}

export interface LogWorkoutDialogProps {
  isOpen?: boolean
  onClose: () => void
  workout?: WorkoutProps | null
  dateStr?: string
  onSave?: (loggedData: LoggedWorkoutPayload) => void
  onDelete?: () => void
}
