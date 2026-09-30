import {
  PulseIcon as BaseIcon,
  PathIcon as LongIcon,
  TimerIcon as IntervalsIcon,
  MountainsIcon as TrailIcon,
  LightningIcon as SpeedIcon,
  SpeedometerIcon as FartlekIcon,
  CrosshairIcon as PamIcon,
  TrendUpIcon as HillsIcon,
  TrophyIcon as RaceIcon,
  CoffeeIcon as RestIcon,
  Icon,
} from '@phosphor-icons/react'
import { IntensityZone, AthleteCategoryCode, AthleteLevelCode, WorkoutType } from '@/types'

export interface WorkoutTypeConfig {
  icon: Icon
}

export const WORKOUT_TYPES_CONFIG: Record<WorkoutType, WorkoutTypeConfig> = {
  Base: { icon: BaseIcon },
  Long: { icon: LongIcon },
  Intervals: { icon: IntervalsIcon },
  Trail: { icon: TrailIcon },
  Speed: { icon: SpeedIcon },
  Fartlek: { icon: FartlekIcon },
  PAM: { icon: PamIcon },
  Hills: { icon: HillsIcon },
  Race: { icon: RaceIcon },
  Rest: { icon: RestIcon },
} as const

export interface HrZoneStyles {
  bg: string
  border: string
  text: string
  textMuted: string
  badgeBg?: string
}

export interface HrZoneConfig {
  code: IntensityZone
  pct: string
  rpe: string
  styles: HrZoneStyles
}

export const HR_ZONES: Record<IntensityZone, HrZoneConfig> = {
  Z1: { code: 'Z1', pct: '50-60%', rpe: '1-2', styles: { bg: 'bg-hr-z1/5', border: 'border-hr-z1/20', text: 'text-hr-z1', textMuted: 'text-hr-z1/70', badgeBg: 'bg-hr-z1' } },
  Z2: { code: 'Z2', pct: '60-70%', rpe: '3-4', styles: { bg: 'bg-hr-z2/5', border: 'border-hr-z2/20', text: 'text-hr-z2', textMuted: 'text-hr-z2/70', badgeBg: 'bg-hr-z2' } },
  Z3: { code: 'Z3', pct: '70-80%', rpe: '5-6', styles: { bg: 'bg-hr-z3/5', border: 'border-hr-z3/20', text: 'text-hr-z3', textMuted: 'text-hr-z3/70', badgeBg: 'bg-hr-z3' } },
  Z4: { code: 'Z4', pct: '80-90%', rpe: '7-8', styles: { bg: 'bg-hr-z4/5', border: 'border-hr-z4/20', text: 'text-hr-z4', textMuted: 'text-hr-z4/70', badgeBg: 'bg-hr-z4' } },
  Z5: { code: 'Z5', pct: '90-100%', rpe: '9-10', styles: { bg: 'bg-hr-z5/5', border: 'border-hr-z5/20', text: 'text-hr-z5', textMuted: 'text-hr-z5/70', badgeBg: 'bg-hr-z5' } },
}

interface RpeLevel {
  value: number
  colorClass: string
}

export const RPE_LEVELS: readonly RpeLevel[] = [
  { value: 0, colorClass: 'bg-muted text-white' },
  { value: 1, colorClass: 'bg-hr-z1 text-white' },
  { value: 2, colorClass: 'bg-hr-z1 text-white' },
  { value: 3, colorClass: 'bg-hr-z2 text-white' },
  { value: 4, colorClass: 'bg-hr-z2 text-white' },
  { value: 5, colorClass: 'bg-hr-z3 text-white' },
  { value: 6, colorClass: 'bg-hr-z3 text-white' },
  { value: 7, colorClass: 'bg-hr-z4 text-white' },
  { value: 8, colorClass: 'bg-hr-z4 text-white' },
  { value: 9, colorClass: 'bg-hr-z5 text-white' },
  { value: 10, colorClass: 'bg-hr-z5 text-white' },
] as const

export interface CategoryMetadata {
  code: AthleteCategoryCode
}

export const ATHLETE_CATEGORIES: Record<AthleteCategoryCode, CategoryMetadata> = {
  E: { code: 'E' },
  U: { code: 'U' },
  M: { code: 'M' },
  H: { code: 'H' },
  S: { code: 'S' },
  B: { code: 'B' },
}

export interface LevelMetadata {
  code: AthleteLevelCode
}

export const ATHLETE_LEVELS: Record<AthleteLevelCode, LevelMetadata> = {
  1: { code: '1' },
  2: { code: '2' },
  3: { code: '3' },
}


