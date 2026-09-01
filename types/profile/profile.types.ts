import { AthletePhysiology } from '@/types/athlete/physiology.types'

export interface EditProfileFormValues {
  email: string
  firstName: string
  lastName: string

  nickName?: string
  phone?: string
  emergencyContact?: string
  emergencyPhone?: string

  physiology: AthletePhysiology
}

export interface ProfileStatsSummary {
  totalDistanceKm: number
  totalElevationGainM: number
  totalWorkoutsCompleted: number
  currentStreakDays: number
}

export interface CreateAthleteFormValues {
  userName: string
  email: string
  firstName: string
  lastName: string

  teamId: string
  groupId: string | null

  nickName?: string
  dni: string
  birthday?: string

  phone?: string
  emergencyContact?: string
  emergencyPhone?: string
}

export interface ChangeAthleteGroupFormValues {
  athleteId: string
  newGroupId: string
  effectiveDate: string
  reason?: string
}
