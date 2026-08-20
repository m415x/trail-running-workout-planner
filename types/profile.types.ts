import { User, AthletePhysiology } from './athlete.types'

// Estado del formulario de edición en ProfileTab
export interface EditProfileFormValues {
  firstName: string
  lastName: string
  nickName?: string
  phone?: string
  emergencyContact?: string
  emergencyPhone?: string
  group: User['group']
  physiology: AthletePhysiology
}

// Estadísticas acumuladas que se muestran en ProfileTab
export interface ProfileStatsSummary {
  totalDistanceKm: number
  totalElevationGainM: number
  totalWorkoutsCompleted: number
  currentStreakDays: number
}
