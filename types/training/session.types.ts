import type { BaseEntity } from '@/types/core/base.types'

export interface Session extends BaseEntity {
  teamId: string
  workoutId?: string | null
  date: string
  title: string
  locationKey?: string | null
  trackPath?: string | null
  notes?: string | null
}
