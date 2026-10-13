import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { workouts } from '@/db/schema'
import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'
import {
  resolveAuthorizedWorkoutTemplateTeam,
} from './authorized-workout-template-operations'
import {
  createWorkoutTemplateRecord,
  duplicateWorkoutTemplateRecord,
  setWorkoutTemplateArchiveStatusRecord,
  updateWorkoutTemplateRecord,
  type WorkoutTemplatePersistenceValues,
} from './workout-template-persistence'

type Row = typeof workouts.$inferSelect

interface Deps {
  database: typeof db
  authenticate(): Promise<RequireAuthenticatedActionResult>
  resolveActiveTeam(): Promise<string | null>
  authorize(
    access: RequireAuthenticatedActionResult,
    teamId: string,
  ): Promise<{ allowed: boolean; teamId?: string }>
  now?: () => string
}

type Denied = { status: 'denied' as const }
type Allowed = { status: 'allowed' as const }

/**
 * Dependency-injected repository boundary shared by production Coach Template
 * Server Actions and disposable SQLite acceptance tests.
 *
 * Caller-provided values.teamId is never an authority: successful writes always
 * assign ownership using the currently authorized server-resolved Team.
 */
export function createWorkoutTemplateActionService(deps: Deps) {
  const authorizedTeam = () => resolveAuthorizedWorkoutTemplateTeam(deps)
  const timestamp = () => deps.now?.() ?? new Date().toISOString()

  function existing(teamId: string, id: string): Row | undefined {
    return deps.database.select().from(workouts).where(and(
      eq(workouts.id, id),
      eq(workouts.teamId, teamId),
      eq(workouts.isDeleted, false),
    )).get()
  }

  return {
    async list(): Promise<Denied | (Allowed & { templates: Row[] })> {
      const teamId = await authorizedTeam()
      if (!teamId) return { status: 'denied' }
      const templates = deps.database.select().from(workouts).where(and(
        eq(workouts.teamId, teamId),
        eq(workouts.isDeleted, false),
      )).orderBy(workouts.title).all()
      return { status: 'allowed', templates }
    },

    async get(id: string): Promise<Denied | (Allowed & { template: Row | undefined })> {
      const teamId = await authorizedTeam()
      if (!teamId) return { status: 'denied' }
      return { status: 'allowed', template: existing(teamId, id) }
    },

    async create(id: string, values: WorkoutTemplatePersistenceValues): Promise<Denied | Allowed> {
      const teamId = await authorizedTeam()
      if (!teamId) return { status: 'denied' }
      createWorkoutTemplateRecord({
        id, values: { ...values, teamId }, now: timestamp(), database: deps.database,
      })
      return { status: 'allowed' }
    },

    async update(id: string, values: WorkoutTemplatePersistenceValues): Promise<Denied | Allowed> {
      const teamId = await authorizedTeam()
      if (!teamId || !existing(teamId, id)) return { status: 'denied' }
      const changed = updateWorkoutTemplateRecord({
        id, teamId, values: { ...values, teamId }, now: timestamp(), database: deps.database,
      })
      return changed ? { status: 'allowed' } : { status: 'denied' }
    },

    async duplicate(sourceId: string, duplicateId: string, titlePrefix = 'Copia de'): Promise<Denied | Allowed> {
      const teamId = await authorizedTeam()
      if (!teamId || !existing(teamId, sourceId)) return { status: 'denied' }
      const duplicated = duplicateWorkoutTemplateRecord({
        sourceId, duplicateId, teamId, titlePrefix, now: timestamp(), database: deps.database,
      })
      return duplicated ? { status: 'allowed' } : { status: 'denied' }
    },

    async archive(id: string, archived: boolean): Promise<Denied | Allowed> {
      const teamId = await authorizedTeam()
      if (!teamId || !existing(teamId, id)) return { status: 'denied' }
      const changed = setWorkoutTemplateArchiveStatusRecord({
        id, teamId, archived, now: timestamp(), database: deps.database,
      })
      return changed ? { status: 'allowed' } : { status: 'denied' }
    },
  }
}
