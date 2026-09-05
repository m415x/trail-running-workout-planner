import type { BaseEntity } from '@/types/core/base.types'
import type { TrainingIntensity } from '@/types/training/intensity.types'
import type { SessionStructure } from '@/types/training/session.types'
import type { TrainingVolume } from '@/types/training/volume.types'
import type { WorkoutType } from '@/types/training/workout.types'

/**
 * Session-level values suggested when a coach selects a workout template.
 *
 * These values describe the shared event. Group-specific load and intensity
 * belong to {@link WorkoutTemplatePrescriptionDefaults}.
 */
export interface WorkoutTemplateSessionDefaults {
  title: string
  type: WorkoutType
  locationKey: string | null
  trackPath: string | null
  structure: SessionStructure | null
  notes: string | null
}

/**
 * Group-prescription values suggested by a workout template.
 *
 * Distance is expressed in kilometers, duration in minutes and elevation gain
 * in positive meters. Every value is optional because some templates describe
 * only a reusable structure. The coach may adjust the resulting prescription
 * independently for each selected group.
 */
export interface WorkoutTemplatePrescriptionDefaults extends TrainingVolume {
  intensity: TrainingIntensity | null
  notes: string | null
}

/**
 * Coach-owned reusable workout definition before persistence.
 *
 * Templates belong to one team and provide defaults rather than live data.
 * Selecting one must copy its values into the session form; it must never make
 * an existing session depend on later template changes.
 */
export interface WorkoutTemplateDraft {
  teamId: string
  sessionDefaults: WorkoutTemplateSessionDefaults
  prescriptionDefaults: WorkoutTemplatePrescriptionDefaults
}

/**
 * Persisted reusable workout definition.
 *
 * archivedAt is null while the template is available for new sessions.
 * Archiving hides it from selection without deleting it or changing sessions
 * that were previously created from it.
 */
export interface WorkoutTemplate extends BaseEntity, WorkoutTemplateDraft {
  archivedAt: string | null
}

/**
 * Detached values copied from a template while creating or editing a session.
 *
 * Persistence maps the session defaults to Session and the prescription
 * defaults to each selected GroupSessionPrescription. The source identifier
 * is retained only for traceability; consumers must render the copied values.
 */
export interface WorkoutTemplateSnapshot {
  sourceTemplateId: string
  session: WorkoutTemplateSessionDefaults
  prescription: WorkoutTemplatePrescriptionDefaults
}
