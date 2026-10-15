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
    // postgres.js decodes JSONB. Never parse it again as serialized SQLite text.
    if (!Array.isArray(row.tags) ||
      !row.tags.every(tag => typeof tag === 'string')) {
      throw new Error('Invalid workout template tags source')
    }
    if (row.structure !== null &&
      (typeof row.structure !== 'object' || Array.isArray(row.structure))) {
      throw new Error('Invalid workout template structure source')
    }
    return {
      id: row.id,
      category: row.category,
      tags: [...row.tags] as string[],
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
      structure: row.structure,
      trackPath: row.trackPath,
      locationKey: row.locationKey,
    }
  })

  return { ...scope, templates }
}
