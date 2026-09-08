import type { WorkoutTemplate, WorkoutTemplateSnapshot } from '@/types'

/**
 * Creates detached values to apply to a session from a reusable template.
 *
 * Nested structure and intensity objects are copied as well. Consumers may
 * edit and persist the result without mutating the catalogue template, and
 * later catalogue changes must never alter an already persisted session.
 */
export function createWorkoutTemplateSnapshot(template: WorkoutTemplate): WorkoutTemplateSnapshot {
  return {
    sourceTemplateId: template.id,
    session: {
      ...template.sessionDefaults,
      structure: template.sessionDefaults.structure
        ? { ...template.sessionDefaults.structure }
        : null,
    },
    prescription: {
      ...template.prescriptionDefaults,
      intensity: template.prescriptionDefaults.intensity
        ? { ...template.prescriptionDefaults.intensity }
        : null,
    },
  }
}
