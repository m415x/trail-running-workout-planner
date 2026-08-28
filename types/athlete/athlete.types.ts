import { User } from '@/types/user/user.types'
import { AthleteGroupCode, GroupHistoryRecord } from '@/types/athlete/group.types'
import { AthletePhysiology, MedicalRecord, PhysiologyRecord } from '@/types/athlete/physiology.types'

export interface AthleteProfile {
  userId: string

  nickName?: string
  dni: string
  birthday?: string

  phone?: string
  emergencyContact?: string
  emergencyPhone?: string

  teamId?: string
  group: AthleteGroupCode

  physiology?: AthletePhysiology
  medical?: MedicalRecord

  physiologyHistory?: PhysiologyRecord[]
  groupHistory?: GroupHistoryRecord[]
}

export interface Athlete extends User {
  athleteProfile: AthleteProfile
}
