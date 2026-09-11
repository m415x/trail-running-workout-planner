import type {
  CompetitionDemandAssessment,
  CompetitionWeekCompetitionLoad,
  CompetitionWeekLoad,
  CompetitionWeekTrainingLoad,
  CourseProfile,
  PreCompetitionLoadContext,
  TaperDurationDecision,
  TaperElevationReductionCurve,
  TaperIntensityPreservationDecision,
  TaperIntensityReference,
  TaperVolumeReductionCurve,
} from '@/types/training/competitive-adjustment.types'

export type CompetitionCPlanningTreatment = 'training_stimulus' | 'minimal_adjustment'

export interface CompetitionCWeekContext {
  readonly role: 'development' | 'recovery' | 'other'
  readonly plannedTraining: CompetitionWeekTrainingLoad
}

export interface CompetitionCAdjustmentInput {
  readonly competition: CompetitionWeekCompetitionLoad
  readonly courseProfile: CourseProfile
  readonly preCompetitionLoad: PreCompetitionLoadContext
  readonly intensityReference: TaperIntensityReference
  readonly competitionWeekContext: CompetitionCWeekContext
}

/**
 * Pure H10 proposal for a C-priority competition.
 *
 * Planning importance and physiological demand remain separate. A short C may
 * replace one planned quality exposure, while a demanding C remains visible as
 * physiologically costly even though its planning role is secondary.
 */
export interface CompetitionCAdjustmentProposal {
  readonly priority: 'C'
  readonly strategy: 'specific_stimulus'
  readonly treatment: CompetitionCPlanningTreatment
  readonly competitionId: string
  readonly competitionDate: string
  readonly competitionWeekRole: CompetitionCWeekContext['role']
  readonly competitionActsAsQualityStimulus: boolean
  readonly physiologicalDemandRequiresRecoveryReview: boolean
  readonly demand: CompetitionDemandAssessment
  readonly duration: TaperDurationDecision
  readonly volumeCurve: TaperVolumeReductionCurve
  readonly elevationCurve: TaperElevationReductionCurve
  readonly intensity: TaperIntensityPreservationDecision
  readonly competitionWeek: CompetitionWeekLoad
  readonly requiresCoachReview: boolean
}
