import type {
  IntensityEmphasis,
  IntensityMethod,
  IntensityZone,
  PamPercentage,
} from '@/types/training/intensity.types'
import type { MicrocycleType, PeriodType } from '@/types/training/periodization.types'
import type { SessionStructure } from '@/types/training/session.types'
import type { TrainingVolume } from '@/types/training/volume.types'
import type {
  WorkoutTemplate,
  WorkoutTemplateCategory,
} from '@/types/training/workout-template.types'
import type { WorkoutType } from '@/types/training/workout.types'

/** Weekdays supported by the weekly generation pattern. */
export type TrainingWeekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

/** Functional purpose of a slot inside the weekly training pattern. */
export type WeeklySessionRole =
  | 'base'
  | 'mountain'
  | 'long'
  | 'quality'
  | 'recovery'
  | 'competition'

/**
 * Controls how many sessions are generated for each microcycle.
 *
 * `auto` resolves the weekly frequency from the microcycle and relative load.
 * `fixed` lets the coach repeat an explicit number of sessions every week.
 */
export type WeeklySessionFrequency =
  | {
      mode: 'auto'
    }
  | {
      mode: 'fixed'
      sessionsPerWeek: number
    }

/**
 * One preferred position in a group's usual training week.
 *
 * Roles and workout types are preferences, not hard constraints. Planning,
 * intensity and recovery rules always have higher priority than this pattern.
 * Optional load weights let a pattern distinguish, for example, a Wednesday
 * long run from a larger Saturday mountain long run.
 */
export interface WeeklyTrainingSlot {
  /** Stable identifier inside the pattern, e.g. `monday-base`. */
  key: string
  weekday: TrainingWeekday
  role: WeeklySessionRole
  preferredWorkoutTypes: WorkoutType[]
  preferredTemplateCategories?: WorkoutTemplateCategory[]
  volumeWeight?: number
  elevationWeight?: number
}

/**
 * Reusable weekly structure that guides automatic session generation.
 *
 * The initial coach pattern can describe Monday/Tuesday/Wednesday/Thursday/
 * Saturday without making those days mandatory for every microcycle.
 */
export interface WeeklyTrainingPattern {
  slots: WeeklyTrainingSlot[]
}

/** Selected weekly slot paired with its concrete calendar date. */
export interface DatedTrainingSlot {
  slot: WeeklyTrainingSlot
  date: string
}

/**
 * Describes whether a session load may absorb weekly planning adjustments.
 *
 * A geographical circuit with known distance/elevation is `fixed`; road or
 * otherwise adjustable sessions are normally `flexible`.
 */
export type SessionLoadFlexibility = 'fixed' | 'flexible'

/** Load already assigned to one weekly slot. */
export interface WeeklyLoadAllocation {
  slotKey: string
  flexibility: SessionLoadFlexibility
  distanceKm: number
  elevationGain: number
}

/** Distance assigned to one selected weekly slot before D+ is distributed. */
export interface WeeklyVolumeAllocation {
  slotKey: string
  flexibility: SessionLoadFlexibility
  distanceKm: number
}

/** Result of distributing the microcycle distance across selected sessions. */
export interface WeeklyVolumeDistribution {
  allocations: WeeklyVolumeAllocation[]
  targetVolumeKm: number
  allocatedVolumeKm: number
  remainingVolumeKm: number
  isExceeded: boolean
  warnings: string[]
}

/** Positive elevation assigned to one selected slot independently of distance. */
export interface WeeklyElevationAllocation {
  slotKey: string
  flexibility: SessionLoadFlexibility
  elevationGain: number
}

/** Result of distributing the microcycle positive elevation across sessions. */
export interface WeeklyElevationDistribution {
  allocations: WeeklyElevationAllocation[]
  targetElevationGain: number | null
  allocatedElevationGain: number
  remainingElevationGain: number | null
  isExceeded: boolean
  warnings: string[]
}

/** Intensity assigned to one dated weekly slot from the microcycle target. */
export interface WeeklyIntensityAllocation {
  slotKey: string
  date: string
  isIntense: boolean
  intensityMethod: IntensityMethod
  zone: IntensityZone | null
  pamPercentage: PamPercentage | null
}

/** Result of placing intense stimuli and recovery across a selected week. */
export interface WeeklyIntensityDistribution {
  allocations: WeeklyIntensityAllocation[]
  intenseSessionsTarget: number
  assignedIntenseSessions: number
  minimumRecoveryDaysBetweenIntenseSessions: number
  warnings: string[]
}

/**
 * Calculated weekly load budget used by generation and, later, the preview UI.
 * It is derived state and does not need its own persistence model.
 */
export interface WeeklyLoadBudget {
  targetVolumeKm: number
  targetElevationGain: number | null
  allocatedVolumeKm: number
  allocatedElevationGain: number
  remainingVolumeKm: number
  remainingElevationGain: number | null
  volumeUsageRatio: number
  elevationUsageRatio: number | null
  isVolumeExceeded: boolean
  isElevationExceeded: boolean
}

/** Resolved load target plus the strategy reference needed by AUTO frequency. */
export interface SessionGenerationLoadTarget {
  targetVolumeKm: number
  targetElevationGain: number | null
  targetDurationMin?: number | null
  maximumWeeklyVolumeKm: number
}

/** Resolved intensity intent supplied by the planning layer. */
export interface SessionGenerationIntensityTarget {
  defaultMethod: IntensityMethod
  emphasis: IntensityEmphasis
  intenseSessionsTarget: number
  predominantZone: IntensityZone
  pamPercentageTarget: PamPercentage | null
  minimumRecoveryDaysBetweenIntenseSessions: number
}

/**
 * Planning context required to generate one group's sessions for one week.
 *
 * The generator consumes already-resolved planning targets. It must not
 * recalculate periodization, load progression or intensity strategy.
 */
export interface SessionGenerationContext {
  teamId: string
  groupTrainingPlanId: string
  groupId: string
  microcycleId: string
  period: PeriodType
  microcycleType: MicrocycleType
  startDate: string
  endDate: string
  load: SessionGenerationLoadTarget
  intensity: SessionGenerationIntensityTarget
  frequency: WeeklySessionFrequency
  pattern: WeeklyTrainingPattern
}

/** Inputs to the pure proposal generator. */
export interface SessionGenerationInput {
  context: SessionGenerationContext
  templates: WorkoutTemplate[]
}

/**
 * Shared-event values proposed for Session.
 *
 * Group-specific distance, elevation and intensity intentionally do not live
 * here so compatible groups may reuse the same Session event.
 */
export interface GeneratedSessionEventDraft {
  date: string
  title: string
  type: WorkoutType
  sourceTemplateId: string | null
  locationKey: string | null
  trackPath: string | null
  structure: SessionStructure | null
  notes: string | null
}

/** Group-specific values proposed for GroupSessionPrescription. */
export interface GeneratedGroupPrescriptionDraft extends TrainingVolume {
  groupId: string
  microcycleId: string
  intensityMethod: IntensityMethod
  zone: IntensityZone | null
  pamPercentage: PamPercentage | null
  notes: string | null
}

/**
 * Pure, non-persisted proposal for one generated weekly slot.
 *
 * `generationKey` identifies the group prescription across regenerations and
 * must remain stable for the same plan, microcycle, group and logical slot.
 * `sharedEventKey` identifies the shared Session candidate and deliberately
 * excludes group-specific prescription values.
 */
export interface SessionGenerationProposal {
  generationKey: string
  sharedEventKey: string
  slotKey: string
  role: WeeklySessionRole
  session: GeneratedSessionEventDraft
  prescription: GeneratedGroupPrescriptionDraft
  warnings: string[]
}

/** Result returned by generation before anything is written to persistence. */
export interface SessionGenerationResult {
  proposals: SessionGenerationProposal[]
  warnings: string[]
}

/**
 * Ownership state required by later persistence/regeneration tasks.
 *
 * Regeneration may replace only `generated` records. `generated_modified` and
 * `manual` records belong to the coach and must be preserved.
 */
export type SessionGenerationOwnership =
  | 'generated'
  | 'generated_modified'
  | 'manual'
