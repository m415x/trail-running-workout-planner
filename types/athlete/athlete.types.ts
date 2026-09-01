import { User } from '@/types/user/user.types'
import { AthleteGroup, GroupHistoryRecord } from '@/types/athlete/group.types'
import { AthletePhysiology, MedicalRecord, PhysiologyRecord } from '@/types/athlete/physiology.types'

export type TrainingGoalType = 'race' | 'performance' | 'base' | 'maintenance' | 'custom'
export type TrainingGoalStatus = 'draft' | 'active' | 'completed' | 'cancelled'

export interface TrainingGoal {
  id: string
  athleteId: string

  type: TrainingGoalType
  status: TrainingGoalStatus

  title: string
  description?: string | null
  targetDate?: string | null

  raceName?: string | null
  raceDistanceKm?: number | null
  raceElevationGain?: number | null

  notes?: string | null
}

export interface AthleteProfile {
  id: string
  userId: string

  teamId: string
  groupId: string | null

  nickName?: string | null
  dni: string
  birthday?: string | null

  phone?: string | null
  emergencyContact?: string | null
  emergencyPhone?: string | null

  physiology?: AthletePhysiology | null
  medical?: MedicalRecord | null
}

export interface AthleteProfileWithRelations extends AthleteProfile {
  group?: AthleteGroup | null

  trainingGoals?: TrainingGoal[]
  physiologyHistory?: PhysiologyRecord[]
  groupHistory?: GroupHistoryRecord[]
}

export interface Athlete extends User {
  athleteProfile: AthleteProfileWithRelations
}
