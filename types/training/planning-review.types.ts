import type { CompetitionEntry } from '@/types/training/competition-entry.types'
import type { ReviewedCompetitionMicrocycleAdjustment } from '@/types/training/competition-adjustment-review.types'
import type { CompetitionImpactWindow } from '@/types/training/competition-impact-window.types'
import type { IntensityStrategy, MicrocycleIntensityTarget } from '@/types/training/intensity.types'
import type { LoadStrategy } from '@/types/training/load-strategy.types'
import type {
  GroupSessionPrescription,
  Session,
} from '@/types/training/session.types'
import type {
  SessionEventGenerationProvenance,
  SessionPrescriptionGenerationProvenance,
} from '@/types/training/session-generation.types'
import type {
  GroupTrainingPlan,
  GroupTrainingPlanKind,
  Macrocycle,
  Mesocycle,
  Microcycle,
  TargetElevationSource,
  TargetVolumeSource,
} from '@/types/training/periodization.types'

/**
 * Identifies the exact planning audience represented by one integral review.
 *
 * This is a composition view over H7 plan association semantics. It does not
 * create another source-of-truth for cohort ownership or lineage.
 */
export interface PlanningReviewScope {
  readonly teamId: string
  readonly groupId: string
  readonly groupTrainingPlanId: string
  readonly kind: GroupTrainingPlanKind
  readonly planningCohortId: string | null
  readonly sourceGroupTrainingPlanId: string | null
}

/** Existing H6 ownership attached to a persisted shared Session. */
export interface PlanningReviewSession {
  readonly session: Session
  readonly provenance: SessionEventGenerationProvenance
  readonly prescriptions: readonly PlanningReviewPrescription[]
}

/** Existing H6 ownership attached to one group-owned prescription. */
export interface PlanningReviewPrescription {
  readonly prescription: GroupSessionPrescription
  readonly provenance: SessionPrescriptionGenerationProvenance
}

/**
 * Review annotation for a value that must not be overwritten silently.
 *
 * The annotation only points at the authoritative boundary that owns the
 * protection decision; it deliberately does not introduce a new ownership
 * model alongside H6/H10.
 */
export interface PlanningReviewProtectedValue {
  readonly entityType: 'microcycle' | 'session' | 'prescription'
  readonly entityId: string
  readonly field: string
  readonly sourceBoundary: 'planning_manual' | 'session_generation' | 'competition_adjustment'
  readonly reason: string
}

/** Reference used by integral consistency issues without coupling to UI text. */
export interface PlanningReviewIssueReference {
  readonly entityType:
    | 'plan'
    | 'macrocycle'
    | 'mesocycle'
    | 'microcycle'
    | 'competition'
    | 'competition_window'
    | 'session'
    | 'prescription'
  readonly entityId: string
  readonly field?: string
}

export type PlanningReviewIssueCode =
  | 'scope_plan_id_mismatch'
  | 'scope_group_id_mismatch'
  | 'scope_plan_kind_mismatch'
  | 'scope_cohort_lineage_mismatch'
  | 'load_strategy_plan_mismatch'
  | 'intensity_strategy_plan_mismatch'
  | 'hierarchy_parent_mismatch'
  | 'duplicate_entity_id'
  | 'invalid_date_range'
  | 'child_outside_parent_range'
  | 'invalid_target_value'
  | 'microcycle_target_projection_mismatch'
  | 'intensity_target_microcycle_mismatch'
  | 'intensity_target_infeasible'
  | 'competition_plan_mismatch'
  | 'competition_outside_planning_horizon'
  | 'competition_window_mismatch'
  | 'session_team_mismatch'
  | 'session_outside_microcycle'
  | 'prescription_reference_mismatch'
  | 'invalid_generation_provenance'
  | 'protected_value_reference_missing'

/**
 * Cross-domain issue surfaced before persistence.
 *
 * Stable issue codes and concrete validation rules are defined by KAN-229;
 * this contract only establishes how issues belong to the review aggregate.
 */
export interface PlanningReviewIssue {
  readonly code: PlanningReviewIssueCode
  readonly severity: 'warning' | 'conflict'
  readonly sourceBoundary:
    | 'planning'
    | 'intensity'
    | 'competition'
    | 'session_generation'
    | 'cohort_resolution'
    | 'persistence'
  readonly message: string
  readonly references: readonly PlanningReviewIssueReference[]
}


/** Pure result of validating one complete review before persistence. */
export interface IntegralPlanningReviewValidation {
  readonly isValid: boolean
  readonly issues: readonly PlanningReviewIssue[]
}

/** Load/provenance state already persisted on one microcycle. */
export interface PlanningReviewMicrocycleTargets {
  readonly targetVolumeKm: number | null
  readonly targetVolumeSource: TargetVolumeSource
  readonly targetElevationGainM: number | null
  readonly targetElevationSource: TargetElevationSource
  readonly targetDurationMin: number | null
}

/** One microcycle with its intensity target and materialized sessions. */
export interface PlanningReviewMicrocycle {
  readonly microcycle: Microcycle
  readonly targets: PlanningReviewMicrocycleTargets
  readonly intensityTarget: MicrocycleIntensityTarget | null
  /** Existing H10 generated/coach sources, when competitive review affected this week. */
  readonly competitiveAdjustmentValueSources:
    | ReviewedCompetitionMicrocycleAdjustment['valueSources']
    | null
  readonly sessions: readonly PlanningReviewSession[]
}

/** Mesocycle node in the integral review hierarchy. */
export interface PlanningReviewMesocycle {
  readonly mesocycle: Mesocycle
  readonly microcycles: readonly PlanningReviewMicrocycle[]
}

/** Macrocycle node in the integral review hierarchy. */
export interface PlanningReviewMacrocycle {
  readonly macrocycle: Macrocycle
  readonly mesocycles: readonly PlanningReviewMesocycle[]
}

/**
 * Competition calendar entry paired with any derived H10 impact window.
 * A competition may legitimately have no window yet (for example before a
 * proposal is generated or when lifecycle/status rules exclude adjustment).
 */
export interface PlanningReviewCompetition {
  readonly entry: CompetitionEntry
  readonly impactWindow: CompetitionImpactWindow | null
}


/** Existing planning/H10 provenance projected for one reviewed microcycle. */
export interface PlanningReviewMicrocycleProvenance {
  readonly microcycleId: string
  readonly targetSources: Pick<
    PlanningReviewMicrocycleTargets,
    'targetVolumeSource' | 'targetElevationSource'
  >
  readonly competitiveAdjustmentValueSources:
    | ReviewedCompetitionMicrocycleAdjustment['valueSources']
    | null
  readonly protectedValues: readonly PlanningReviewProtectedValue[]
}

/** Existing H6 provenance projected for one reviewed prescription. */
export interface PlanningReviewPrescriptionProvenance {
  readonly prescriptionId: string
  readonly provenance: SessionPrescriptionGenerationProvenance
  readonly replaceableByRegeneration: boolean
  readonly protectedValues: readonly PlanningReviewProtectedValue[]
}

/** Existing H6 provenance projected for one shared session event. */
export interface PlanningReviewSessionProvenance {
  readonly sessionId: string
  readonly provenance: SessionEventGenerationProvenance
  readonly replaceableByRegeneration: boolean
  readonly protectedValues: readonly PlanningReviewProtectedValue[]
  readonly prescriptions: readonly PlanningReviewPrescriptionProvenance[]
}

/**
 * Provenance projection for review consumers.
 *
 * Every source and ownership value is the authoritative H7/H6/H10 type. The
 * projection only groups and exposes those values; it defines no replacement
 * ownership state.
 */
export interface IntegralPlanningReviewProvenance {
  readonly plan: PlanningReviewScope
  readonly microcycles: readonly PlanningReviewMicrocycleProvenance[]
  readonly sessions: readonly PlanningReviewSessionProvenance[]
  readonly protectedValues: readonly PlanningReviewProtectedValue[]
}

/** Aggregate totals used consistently at macro, meso and full-plan levels. */
export interface PlanningReviewTotals {
  readonly targetVolumeKm: number
  readonly targetElevationGainM: number
  readonly targetDurationMin: number
  readonly microcycleCount: number
  readonly sessionCount: number
  readonly prescriptionCount: number
  readonly competitionCount: number
}

/** Weekly distribution projected from one reviewed microcycle. */
export interface PlanningReviewWeekSummary extends PlanningReviewTotals {
  readonly microcycleId: string
  readonly weekNumber: number
  readonly startDate: string
  readonly endDate: string
}

/** Mesocycle totals plus its ordered week distribution. */
export interface PlanningReviewMesocycleSummary {
  readonly mesocycleId: string
  readonly totals: PlanningReviewTotals
  readonly weeks: readonly PlanningReviewWeekSummary[]
}

/** Macrocycle totals plus nested mesocycle summaries. */
export interface PlanningReviewMacrocycleSummary {
  readonly macrocycleId: string
  readonly totals: PlanningReviewTotals
  readonly mesocycles: readonly PlanningReviewMesocycleSummary[]
}

/** Integral projection consumed by the H11 review UI and later diff boundary. */
export interface IntegralPlanningReviewSummary {
  readonly scope: PlanningReviewScope
  readonly totals: PlanningReviewTotals
  readonly macrocycles: readonly PlanningReviewMacrocycleSummary[]
  readonly competitions: readonly PlanningReviewCompetition[]
  readonly provenance: IntegralPlanningReviewProvenance
}

/**
 * Pure, persistence-agnostic representation reviewed by the coach in H11.
 *
 * It composes authoritative H6–H10 contracts. No field here changes ownership,
 * cohort lineage, competition semantics or persistence state by itself.
 */
export interface IntegralPlanningReview {
  readonly scope: PlanningReviewScope
  readonly plan: GroupTrainingPlan
  readonly loadStrategy: LoadStrategy | null
  readonly intensityStrategy: IntensityStrategy | null
  readonly macrocycles: readonly PlanningReviewMacrocycle[]
  readonly competitions: readonly PlanningReviewCompetition[]
  readonly protectedValues: readonly PlanningReviewProtectedValue[]
  readonly issues: readonly PlanningReviewIssue[]
}
