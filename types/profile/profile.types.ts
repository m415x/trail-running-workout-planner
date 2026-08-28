import { AthleteGroupCode } from '@/types/athlete/group.types'
import { AthletePhysiology } from '@/types/athlete/physiology.types'

export interface EditProfileFormValues {
  firstName: string
  lastName: string
  nickName?: string
  phone?: string
  emergencyContact?: string
  emergencyPhone?: string
  group: AthleteGroupCode
  physiology: AthletePhysiology
}

// Estadísticas acumuladas que se muestran en ProfileTab
export interface ProfileStatsSummary {
  totalDistanceKm: number
  totalElevationGainM: number
  totalWorkoutsCompleted: number
  currentStreakDays: number
}
