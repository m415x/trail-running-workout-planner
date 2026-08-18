import { AthleteGroupCode } from '@/types/athlete-groups.types'
import { TrainingLocationKey } from '@/features/workouts/types/workout.types'

export interface GroupVolumeOverride {
  km: number
  timeMin?: number
  intervals?: string // ej: "8x800m" para M1, "6x800m" para M2, "4x800m" para M3
  notes?: string
}

export interface DailyWorkoutSession {
  id: string
  date: string // 'YYYY-MM-DD'
  title: string // ej: "Series de Umbral en Pista"
  structure: {
    warmup: string // "15 min Z1/Z2 + Movilidad"
    mainBlock: string // "Pasadas de 1000m en Z4 rec 2 min"
    cooldown: string // "10 min Z1 regenerativo"
  }
  intensityZone: 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5'
  locationKey?: TrainingLocationKey
  gpxPath?: string

  // Volumen base por defecto (referencia general)
  defaultVolume: {
    km: number
    timeMin: number
  }

  // Sobrescritura específica por grupo/nivel
  groupOverrides: Partial<Record<AthleteGroupCode, GroupVolumeOverride>>
}
