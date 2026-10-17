import type { TrainingIntensity, IntensityZone } from '@/types/training/intensity.types'
import type { SessionStructure } from '@/types/training/session.types'
import type {
  WorkoutTemplate,
  WorkoutTemplateCategory,
} from '@/types/training/workout-template.types'
import { isWorkoutType } from '@/types/training/workout.types'
import type {
  ReviewWorkoutTemplateCatalogueFacts,
  ReviewWorkoutTemplateFacts,
} from './review-snapshot-workout-templates-sqlite'

const CATEGORIES = new Set<string>([
  'endurance', 'quality', 'mountain', 'technique', 'recovery', 'competition',
])
const ZONES = new Set<string>(['Z1', 'Z2', 'Z3', 'Z4', 'Z5'])

function projectIntensity(facts: ReviewWorkoutTemplateFacts): TrainingIntensity | null {
  if (facts.intensityMethod === null) {
    if (facts.zone !== null || facts.referencePercentage !== null) {
      throw new Error('Invalid template intensity without method')
    }
    return null
  }
  if (facts.intensityMethod === 'hr_zone') {
    if (facts.zone === null || !ZONES.has(facts.zone) || facts.referencePercentage !== null) {
      throw new Error('Invalid template intensity zone')
    }
    return { method: 'hr_zone', zone: facts.zone as IntensityZone }
  }
  if (facts.intensityMethod === 'reference_percentage') {
    if (facts.zone !== null || facts.referencePercentage === null ||
      !Number.isFinite(facts.referencePercentage)) {
      throw new Error('Invalid template intensity reference percentage')
    }
    return { method: 'reference_percentage', referencePercentage: facts.referencePercentage }
  }
  throw new Error('Invalid template intensity method')
}

/**
 * Materialize the effective WorkoutTemplate values expected by the generation
 * domain from previously Team-scoped and active SQL facts. The source reader
 * already excludes archived and deleted rows. No invented timestamps.
 *
 * This pure projection does not authorize the actor or query SQL.
 */
export function projectReviewSqlWorkoutTemplates(
  source: ReviewWorkoutTemplateCatalogueFacts,
): WorkoutTemplate[] {
  return source.templates.map(facts => {
    if (!CATEGORIES.has(facts.category) || !isWorkoutType(facts.type) ||
      !Array.isArray(facts.tags) || !facts.tags.every(tag => typeof tag === 'string')) {
      throw new Error('Invalid persisted workout template category, type or tags')
    }
    return {
      id: facts.id,
      teamId: source.teamId,
      category: facts.category as WorkoutTemplateCategory,
      tags: [...facts.tags],
      archivedAt: null,
      isDeleted: false,
      sessionDefaults: {
        title: facts.title,
        type: facts.type,
        locationKey: facts.locationKey,
        trackPath: facts.trackPath,
        structure: facts.structure === null
          ? null
          : structuredClone(facts.structure) as SessionStructure,
        notes: facts.notes,
      },
      prescriptionDefaults: {
        distanceKm: facts.distanceKm,
        durationMin: facts.durationMin,
        elevationGain: facts.elevationGain,
        intensity: projectIntensity(facts),
        notes: facts.prescriptionNotes,
      },
    }
  })
}
