import type { CompetitionPriority } from '@/types/training/competition-entry.types'
import type {
  CompetitionDemandAssessment,
  CompetitionDemandBand,
  CompetitionDemandConfidence,
  CourseProfile,
  PostCompetitionPlanningProtection,
} from '@/types/training/competitive-adjustment.types'

export type RecoveryDemandBand = 'minimal' | 'low' | 'moderate' | 'high' | 'very_high' | 'unknown'

export type RecoveryPhase = 'acute_recovery' | 'recovery' | 'progressive_reentry'

export type RecoveryReasonCode =
  | 'competition_demand'
  | 'competition_demand_unknown'
  | 'downhill_load_available'
  | 'downhill_load_unknown'
  | 'technicality_available'
  | 'priority_planning_protection'

export interface RecoveryDemandAssessment {
  readonly band: RecoveryDemandBand
  readonly confidence: CompetitionDemandConfidence
  readonly competitionDemandBand: CompetitionDemandBand
  readonly courseEffortKm: number | null
  readonly elevationLossM: number | null
  readonly downhillLoadKnown: boolean
  readonly technicalityKnown: boolean
  readonly requiresCoachReview: boolean
}

export interface RecoveryPhaseDecision {
  readonly phase: RecoveryPhase
  readonly durationDays: number
  readonly trainingLoadCeilingPercentage: number
  readonly allowIntenseSessions: boolean
}

/**
 * Post-race physiological recovery is demand-driven. Priority changes how the
 * resulting recovery is protected in planning, never how hard the event was.
 */
export interface RecoveryDecision {
  readonly priority: CompetitionPriority
  readonly demand: RecoveryDemandAssessment
  readonly planningProtection: PostCompetitionPlanningProtection
  readonly phases: readonly RecoveryPhaseDecision[]
  readonly totalRecoveryDays: number
  readonly requiresCoachReview: boolean
  readonly reasonCodes: readonly RecoveryReasonCode[]
}

export interface RecoveryDecisionInput {
  readonly priority: CompetitionPriority
  readonly courseProfile: CourseProfile
  /** Reuse an already computed assessment when composing a competition proposal. */
  readonly competitionDemand?: CompetitionDemandAssessment
}
