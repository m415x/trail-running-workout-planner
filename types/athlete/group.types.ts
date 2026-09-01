import { BaseEntity } from '@/types/core/base.types'

export type AthleteCategoryCode = 'E' | 'U' | 'M' | 'H' | 'S' | 'B'
export type AthleteLevelCode = '1' | '2' | '3'
export type AthleteGroupCode = `${AthleteCategoryCode}${AthleteLevelCode}`

export interface AthleteGroup extends BaseEntity {
  teamId: string

  categoryCode: AthleteCategoryCode
  levelCode: AthleteLevelCode

  description?: string | null
  isActive: boolean
}

export interface GroupHistoryRecord extends BaseEntity {
  athleteId: string
  date: string

  previousGroupId?: string | null
  newGroupId: string

  changedByUserId?: string | null
  reason?: string | null
}

export interface GroupHistoryRecordWithRelations extends GroupHistoryRecord {
  previousGroup?: AthleteGroup | null
  newGroup: AthleteGroup
}
