import type { CompetitionEntry } from '@/types/training/competition-entry.types'
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

/**
 * Cross-domain issue surfaced before persistence.
 *
 * Stable issue codes and concrete validation rules are defined by KAN-229;
 * this contract only establishes how issues belong to the review aggregate.
 */
export interface PlanningReviewIssue {
  readonly code: string
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
