'use server'

import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { workouts } from '@/db/schema'
import { matchesWorkoutTemplateSearch } from '@/lib/workout-templates/workout-template-search'
import type { TrainingIntensity, WorkoutTemplate, WorkoutTemplateSearchCriteria } from '@/types'

const CURRENT_TEAM_ID = 'team_1'

function resolveIntensity(row: typeof workouts.$inferSelect): TrainingIntensity | null {
  if (row.intensityMethod === 'hr_zone' && row.zone) return { method: 'hr_zone', zone: row.zone }
  if (row.intensityMethod === 'pam_percentage' && row.pamPercentage !== null) {
    return { method: 'pam_percentage', pamPercentage: row.pamPercentage }
  }
  return null
}

function toWorkoutTemplate(row: typeof workouts.$inferSelect): WorkoutTemplate {
  return {
    id: row.id,
    teamId: row.teamId,
    category: row.category,
    tags: row.tags,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isDeleted: row.isDeleted,
    sessionDefaults: {
      title: row.title,
      type: row.type,
      locationKey: row.locationKey,
      trackPath: row.trackPath,
      structure: row.structure,
      notes: row.notes,
    },
    prescriptionDefaults: {
      distanceKm: row.distance,
      durationMin: row.time,
      elevationGain: row.gain,
      intensity: resolveIntensity(row),
      notes: row.prescriptionNotes,
    },
  }
}

/**
 * Returns the reusable workout catalogue owned by one team.
 *
 * Deleted records are always excluded. Catalogue criteria use accent-insensitive
 * text matching and AND semantics between different filter groups.
 */
export async function getWorkoutTemplates(
  criteria: WorkoutTemplateSearchCriteria = {},
  teamId: string = CURRENT_TEAM_ID,
) {
  const rows = db.query.workouts.findMany({
    where: and(eq(workouts.teamId, teamId), eq(workouts.isDeleted, false)),
    orderBy: (table, { asc }) => [asc(table.title)],
  }).sync()
  const catalogue = rows.map(toWorkoutTemplate)

  return {
    templates: catalogue.filter((template) => matchesWorkoutTemplateSearch(template, criteria)),
    availableTags: [...new Set(catalogue.flatMap((template) => template.tags))]
      .sort((left, right) => left.localeCompare(right, 'es', { sensitivity: 'base' })),
  }
}
