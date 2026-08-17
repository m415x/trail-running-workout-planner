export type NavigationTab = 'home' | 'plan' | 'stats' | 'profile'

export interface DayConfig {
  index: number
  short: string
  twoLetter: string
  medium: string
  full: string
}

export interface MonthConfig {
  index: number
  short: string
  full: string
}

export interface UserProps {
  id: string
  firstName: string
  lastName: string
  nickName?: string
  dni: string
  birthday?: string
  email: string
  phone?: string
  emergencyContact?: string
  emergencyPhone?: string
  avatar?: string
  teamRole?: string
}

export interface TeamProps {
  id: string
  name: string
  description?: string
  avatar?: string
  members?: UserProps[]
}
