import type postgres from 'postgres'

import type {
  ReviewWorkoutTemplateCatalogueFacts,
  ReviewWorkoutTemplateFacts,
  ReviewWorkoutTemplateScope,
} from './review-snapshot-workout-templates-sqlite'

interface WorkoutRow extends Omit<ReviewWorkoutTemplateFacts, 'tags' | 'structure'> {
  readonly tags: unknown
  readonly structure: unknown | null
}

/**
 * The PostgreSQL wire client can supply JSONB as already decoded values or
 * serialized JSON strings. Normalize only that transport distinction, while
 * keeping malformed persisted data a hard error (never an empty catalogue).
 */
function decodeWorkoutJson(value: unknown, label: string): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    throw new Error('Invalid workout template ' + label + ' JSON source')
  }
}

/**
 * PG-2: reads the Team-owned active workout catalogue from the same
 * SERIALIZABLE TransactionSql as the enclosing confirmation.
 *
 * This SQL ownership read does NOT authorize an H2/H3/H4A actor; the
 * confirmation boundary must establish that independently. SQL failures
 * must propagate, not become an empty catalogue.
 */
export async function readReviewWorkoutTemplateFactsPostgres(
  tx: postgres.TransactionSql,
  scope: ReviewWorkoutTemplateScope,
): Promise<ReviewWorkoutTemplateCatalogueFacts | null> {
  if (!scope.groupTrainingPlanId?.trim() ||
    !scope.teamId?.trim() || !scope.groupId?.trim()) return null

  const plan = await tx<{ id: string }[]>`
    SELECT p.id FROM group_training_plans AS p
    INNER JOIN athlete_groups AS g ON g.id = p.group_id
    INNER JOIN teams AS team ON team.id = g.team_id
    WHERE p.id = ${scope.groupTrainingPlanId}
      AND p.group_id = ${scope.groupId}
      AND g.team_id = ${scope.teamId}
      AND p.is_deleted = false
      AND g.is_deleted = false
      AND team.is_deleted = false
    LIMIT 1
  `
  if (!plan[0]) return null

  const rows = await tx<WorkoutRow[]>`
    SELECT
      id, category, tags, title, type,
      distance AS "distanceKm",
      time AS "durationMin",
      gain AS "elevationGain",
      intensity_method AS "intensityMethod",
      zone, reference_percentage AS "referencePercentage",
      notes, prescription_notes AS "prescriptionNotes",
      structure, track_path AS "trackPath", location_key AS "locationKey"
    FROM workouts
    WHERE team_id = ${scope.teamId}
      AND is_deleted = false
      AND archived_at IS NULL
    ORDER BY title, id
  `

  const templates: ReviewWorkoutTemplateFacts[] = rows.map(row => {
    const tags = decodeWorkoutJson(row.tags, 'tags')
    if (!Array.isArray(tags) || !tags.every(tag => typeof tag === 'string')) {
      throw new Error('Invalid workout template tags source')
    }
    const structure = row.structure === null
      ? null
      : decodeWorkoutJson(row.structure, 'structure')
    if (structure !== null &&
      (typeof structure !== 'object' || Array.isArray(structure))) {
      throw new Error('Invalid workout template structure source')
    }
    return {
      id: row.id,
      category: row.category,
      tags: [...tags] as string[],
      title: row.title,
      type: row.type,
      distanceKm: row.distanceKm,
      durationMin: row.durationMin,
      elevationGain: row.elevationGain,
      intensityMethod: row.intensityMethod,
      zone: row.zone,
      referencePercentage: row.referencePercentage,
      notes: row.notes,
      prescriptionNotes: row.prescriptionNotes,
      structure,
      trackPath: row.trackPath,
      locationKey: row.locationKey,
    }
  })

  return { ...scope, templates }
}
