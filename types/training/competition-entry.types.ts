import type { BaseEntity } from '@/types/core/base.types'

export type CompetitionPriority = 'A' | 'B' | 'C'
export type CompetitionStatus = 'scheduled' | 'cancelled'

/**
 * One concrete competition modality attached to a GroupTrainingPlan.
 *
 * CompetitionEntry is planning context, not an athlete TrainingGoal and not a
 * Macrocycle owner. Distance is mandatory because competitive planning cannot
 * be built without knowing the modality being prepared.
 */
export interface CompetitionEntry extends BaseEntity {
  groupTrainingPlanId: string
  name: string
  /** Calendar date in YYYY-MM-DD format. */
  date: string
  /** Competitive distance in kilometers. Must be finite and greater than zero. */
  distanceKm: number
  /** Positive elevation gain in meters (m+). Zero is valid for flat courses. */
  elevationGainM?: number | null
  priority: CompetitionPriority
  status: CompetitionStatus
  description?: string | null
}

/**
 * Mutable fields accepted when creating or editing a CompetitionEntry before
 * persistence metadata is assigned.
 */
export type CompetitionEntryDraft = Omit<CompetitionEntry, keyof BaseEntity>
