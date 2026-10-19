import type Database from 'better-sqlite3'

/**
 * KAN-790/T5.3 — verifies persisted microcycle ancestry for exactly one
 * GroupTrainingPlan. Base and Variant can share a Sporting Group but never
 * share authority over each other's microcycle IDs.
 *
 * Read-only by contract: this check neither repairs nor updates planning.
 * CREATE must call it before allocating an authorized review snapshot.
 */
export function validateGeneratedMicrocycleLineageSqlite(
  database: Database.Database,
  input: {
    readonly groupTrainingPlanId: string
    readonly microcycleIds: readonly string[]
  },
): boolean {
  if (typeof input.groupTrainingPlanId !== 'string' ||
    !input.groupTrainingPlanId.trim() ||
    !Array.isArray(input.microcycleIds) ||
    input.microcycleIds.some(id => typeof id !== 'string' || !id.trim())) {
    return false
  }

  const plan = database.prepare(`
    SELECT id FROM group_training_plans
    WHERE id = ? AND is_deleted = 0
    LIMIT 1
  `).get(input.groupTrainingPlanId)
  if (!plan) return false

  const uniqueIds = [...new Set(input.microcycleIds)]
  if (uniqueIds.length === 0) return true

  // A checked ID must have one complete, non-deleted ancestry chain ending in
  // the exact requested Plan — Group alone is insufficient for Base/Variant.
  const placeholders = uniqueIds.map(() => '?').join(', ')
  const row = database.prepare(`
    SELECT COUNT(DISTINCT micro.id) AS matched
    FROM microcycles AS micro
    INNER JOIN mesocycles AS meso ON meso.id = micro.mesocycle_id
    INNER JOIN macrocycles AS macro ON macro.id = meso.macrocycle_id
    INNER JOIN group_training_plans AS plan ON plan.id = macro.group_training_plan_id
    WHERE plan.id = ? AND plan.is_deleted = 0
      AND macro.is_deleted = 0 AND meso.is_deleted = 0 AND micro.is_deleted = 0
      AND micro.id IN (${placeholders})
  `).get(input.groupTrainingPlanId, ...uniqueIds) as { matched: number }

  return row.matched === uniqueIds.length
}
