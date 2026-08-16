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
