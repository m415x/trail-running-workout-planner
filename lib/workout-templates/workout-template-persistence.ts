import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { workouts } from '@/db/schema'

export type WorkoutTemplatePersistenceValues = Omit<
  typeof workouts.$inferInsert,
  'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'archivedAt'
>

interface CreateWorkoutTemplateRecordParams {
  id: string
  values: WorkoutTemplatePersistenceValues
  now?: string
  database?: typeof db
}

interface UpdateWorkoutTemplateRecordParams {
  id: string
  teamId: string
  values: WorkoutTemplatePersistenceValues
  now?: string
  database?: typeof db
}

interface DuplicateWorkoutTemplateRecordParams {
  sourceId: string
  duplicateId: string
  teamId: string
  titlePrefix: string
  now?: string
  database?: typeof db
}

interface SetWorkoutTemplateArchiveStatusParams {
  id: string
  teamId: string
  archived: boolean
  now?: string
  database?: typeof db
}

/** Inserts an active workout template with explicit identity and timestamps. */
export function createWorkoutTemplateRecord({
  id,
  values,
  now = new Date().toISOString(),
  database = db,
}: CreateWorkoutTemplateRecordParams): void {
  database.insert(workouts).values({
    id,
    ...values,
    archivedAt: null,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  }).run()
}

/** Updates a live team-owned template while preserving its identity and archive state. */
export function updateWorkoutTemplateRecord({
  id,
  teamId,
  values,
  now = new Date().toISOString(),
  database = db,
}: UpdateWorkoutTemplateRecordParams): boolean {
  const result = database.update(workouts)
    .set({ ...values, updatedAt: now })
    .where(and(eq(workouts.id, id), eq(workouts.teamId, teamId), eq(workouts.isDeleted, false)))
    .run()

  return result.changes > 0
}

/** Creates an active independent copy of a live team-owned template. */
export function duplicateWorkoutTemplateRecord({
  sourceId,
  duplicateId,
  teamId,
  titlePrefix,
  now = new Date().toISOString(),
  database = db,
}: DuplicateWorkoutTemplateRecordParams): boolean {
  const source = database.select().from(workouts).where(and(
    eq(workouts.id, sourceId),
    eq(workouts.teamId, teamId),
    eq(workouts.isDeleted, false),
  )).get()
  if (!source) return false

  database.insert(workouts).values({
    ...source,
    id: duplicateId,
    title: `${titlePrefix} ${source.title}`.slice(0, 120),
    archivedAt: null,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  }).run()

  return true
}

/** Archives or reactivates a live team-owned template without deleting it. */
export function setWorkoutTemplateArchiveStatusRecord({
  id,
  teamId,
  archived,
  now = new Date().toISOString(),
  database = db,
}: SetWorkoutTemplateArchiveStatusParams): boolean {
  const result = database.update(workouts)
    .set({ archivedAt: archived ? now : null, updatedAt: now })
    .where(and(eq(workouts.id, id), eq(workouts.teamId, teamId), eq(workouts.isDeleted, false)))
    .run()

  return result.changes > 0
}
