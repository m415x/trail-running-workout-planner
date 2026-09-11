import type { CompetitionPriority } from '@/types/training/competition-entry.types'
import type { RecoveryDecision } from '@/types/training/recovery-adjustment.types'

export type CompetitionImpactPhase = 'pre' | 'race' | 'post'

export interface CompetitionImpactDateRange {
  readonly startDate: string
  readonly endDate: string
  readonly durationDays: number
}

export interface CompetitionImpactWindowInput {
  readonly competitionId: string
  readonly priority: CompetitionPriority
  readonly competitionDate: string
  readonly taperDurationDays: number
  readonly recovery: RecoveryDecision
}

/** Calendar-local impact window for one competition. */
export interface CompetitionImpactWindow {
  readonly competitionId: string
  readonly priority: CompetitionPriority
  readonly competitionDate: string
  readonly pre: CompetitionImpactDateRange | null
  readonly race: CompetitionImpactDateRange
  readonly post: CompetitionImpactDateRange | null
  readonly startDate: string
  readonly endDate: string
  readonly recovery: RecoveryDecision
}

export type CompetitionImpactOverlapResolution =
  | 'compatible'
  | 'higher_priority_precedence'
  | 'recovery_preserved'
  | 'coach_review_required'

export type CompetitionImpactOverlapReasonCode =
  | 'pre_or_race_overlap'
  | 'higher_priority_competition'
  | 'same_priority_overlap'
  | 'recovery_overlap'
  | 'race_during_pending_recovery'
  | 'recovery_cannot_be_discarded'

export interface CompetitionImpactOverlap {
  readonly firstCompetitionId: string
  readonly secondCompetitionId: string
  readonly overlapStartDate: string
  readonly overlapEndDate: string
  readonly resolution: CompetitionImpactOverlapResolution
  readonly dominantCompetitionId: string | null
  readonly requiresCoachReview: boolean
  readonly reasonCodes: readonly CompetitionImpactOverlapReasonCode[]
}

export interface CompetitionImpactWindowResolution {
  readonly windows: readonly CompetitionImpactWindow[]
  readonly overlaps: readonly CompetitionImpactOverlap[]
  readonly requiresCoachReview: boolean
}
