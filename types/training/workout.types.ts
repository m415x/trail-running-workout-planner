import { AthleteGroupCode } from '@/types/athlete/group.types'
import type { TrainingIntensity, IntensityZone } from '@/types/training/intensity.types'
import type { RunningReference } from '@/lib/physiology/running-reference'

export type DayStatus = 'completed' | 'partial' | 'missed' | 'pending' | 'rest'
export type WorkoutType =
  | 'Base'
  | 'Long'
  | 'Intervals'
  | 'Trail'
  | 'Speed'
  | 'Fartlek'
  | 'PAM'
  | 'Hills'
  | 'Rest'
  | 'Race'

/** Resolved workout view consumed by the authenticated athlete UI. */
export interface WorkoutProps {
  id?: number | string
  title: string
  type: WorkoutType
  distance: number
  zone: IntensityZone
  intensity?: TrainingIntensity
  runningReference?: RunningReference
  time: number
  gain: number
  pace: number
  notes: string
  targetGroups?: AthleteGroupCode[]
  trackPath?: string
  locationKey?: string
}

/** Weekly calendar navigation structures. */
export interface WeeklyCycle {
  id: string
  title: string
  phase: string
  startDate: string
  endDate: string
  targetKm: number
}

export interface WeekDayRaw {
  date: string
  completedKm?: number
  type?: WorkoutType
  isToday?: boolean
  isRest?: boolean
  isDone?: boolean
  isPartial?: boolean
  isMissed?: boolean
  status?: DayStatus
  /** True when durable realized evidence exists without an official session link. */
  hasUnplannedTraining?: boolean
  workoutId?: number
}

export interface WeekDay extends WeekDayRaw {
  day?: string
  dayName?: string
  dayNumber?: number
  fullDate?: string
  km?: number
}
