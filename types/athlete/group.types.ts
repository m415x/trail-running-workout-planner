import { BaseEntity } from '@/types/core/base.types'

export type AthleteCategoryCode = 'E' | 'U' | 'M' | 'H' | 'S' | 'B'
export type AthleteLevelCode = '1' | '2' | '3'
export type AthleteGroupCode = `${AthleteCategoryCode}${AthleteLevelCode}`

export interface GroupHistoryRecord extends BaseEntity {
  athleteId: string
  date: string
  previousGroup?: AthleteGroupCode
  newGroup: AthleteGroupCode
  promotedByUserId?: string
  reason?: string
}
