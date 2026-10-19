import type Database from 'better-sqlite3'

/**
 * KAN-790/T5.3 — persisted, team-owned active workout catalogue facts.
 * This is only a partial generation source, not a canonical full manifest or
 * a substitute for H2/H3/H4A authorization by the calling server boundary.
 */
export interface ReviewWorkoutTemplateScope {
  readonly groupTrainingPlanId: string
  readonly teamId: string
  readonly groupId: string
}

export interface ReviewWorkoutTemplateFacts {
  readonly id: string
  readonly category: string
  readonly tags: readonly string[]
  readonly title: string
  readonly type: string
  readonly distanceKm: number | null
  readonly durationMin: number | null
  readonly elevationGain: number | null
  readonly intensityMethod: string | null
  readonly zone: string | null
  readonly referencePercentage: number | null
  readonly notes: string | null
  readonly prescriptionNotes: string | null
  readonly structure: unknown | null
  readonly trackPath: string | null
  readonly locationKey: string | null
}

export interface ReviewWorkoutTemplateCatalogueFacts extends ReviewWorkoutTemplateScope {
  readonly templates: readonly ReviewWorkoutTemplateFacts[]
}

interface WorkoutRow {
  readonly id: string
  readonly category: string
  readonly tags: string
  readonly title: string
  readonly type: string
  readonly distanceKm: number | null
  readonly durationMin: number | null
  readonly elevationGain: number | null
  readonly intensityMethod: string | null
  readonly zone: string | null
  readonly referencePercentage: number | null
  readonly notes: string | null
  readonly prescriptionNotes: string | null
  readonly structure: string | null
  readonly trackPath: string | null
  readonly locationKey: string | null
}

function parseTemplateJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    throw new Error('Invalid workout template ' + label + ' JSON source')
  }
}

/**
 * Re-reads active templates for the Team owning an explicitly scoped Plan.
 * Only SQL predicates establish ownership; archived/deleted templates do not
 * participate in generation. All source values are independently materialized.
 */
export function readReviewWorkoutTemplateFactsSqlite(
  sqlite: Database.Database,
  scope: ReviewWorkoutTemplateScope,
): ReviewWorkoutTemplateCatalogueFacts | null {
  if (typeof scope.groupTrainingPlanId !== 'string' || !scope.groupTrainingPlanId.trim() ||
    typeof scope.teamId !== 'string' || !scope.teamId.trim() ||
    typeof scope.groupId !== 'string' || !scope.groupId.trim()) {
    return null
  }

  const authorizedPlan = sqlite.prepare(`
    SELECT p.id
    FROM group_training_plans AS p
    INNER JOIN athlete_groups AS g ON g.id = p.group_id
    WHERE p.id = ? AND p.group_id = ? AND g.team_id = ?
      AND p.is_deleted = 0 AND g.is_deleted = 0
  `).get(scope.groupTrainingPlanId, scope.groupId, scope.teamId)
  if (!authorizedPlan) return null

  const rows = sqlite.prepare(`
    SELECT
      id, category, tags, title, type,
      distance AS distanceKm,
      time AS durationMin,
      gain AS elevationGain,
      intensity_method AS intensityMethod,
      zone, reference_percentage AS referencePercentage,
      notes, prescription_notes AS prescriptionNotes,
      structure, track_path AS trackPath, location_key AS locationKey
    FROM workouts
    WHERE team_id = ? AND is_deleted = 0 AND archived_at IS NULL
    ORDER BY title, id
  `).all(scope.teamId) as WorkoutRow[]

  const templates = rows.map(row => {
    const tags = parseTemplateJson(row.tags, 'tags')
    if (!Array.isArray(tags) || !tags.every(tag => typeof tag === 'string')) {
      throw new Error('Invalid workout template tags source')
    }
    const structure = row.structure === null ? null : parseTemplateJson(row.structure, 'structure')
    if (row.structure !== null &&
      (structure === null || typeof structure !== 'object' || Array.isArray(structure))) {
      throw new Error('Invalid workout template structure source')
    }
    return {
      id: row.id,
      category: row.category,
      tags,
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

  return {
    groupTrainingPlanId: scope.groupTrainingPlanId,
    teamId: scope.teamId,
    groupId: scope.groupId,
    templates,
  }
}
