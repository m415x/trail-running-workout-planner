import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { workouts } from '@/db/schema'
import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'
import {
  duplicateWorkoutTemplateRecord,
  setWorkoutTemplateArchiveStatusRecord,
} from '@/lib/workout-templates/workout-template-persistence'

export interface AuthorizedWorkoutTemplateOperationsDeps {
  database: typeof db
  /** Resolved from the authenticated actor's server-side active Team context. */
  resolveActiveTeam(): Promise<string | null>
  authenticate(): Promise<RequireAuthenticatedActionResult>
  authorize(
    access: RequireAuthenticatedActionResult,
    teamId: string,
  ): Promise<{ allowed: boolean; teamId?: string }>
}

type Denied = { status: 'denied' }
type Allowed<T> = { status: 'allowed' } & T

/**
 * KAN-794: isolated, dependency-injected Team-owned repository boundary.
 * Not a Server Action and not wired into production until KAN-795/T3.
 */
export function createAuthorizedWorkoutTemplateOperations(
  deps: AuthorizedWorkoutTemplateOperationsDeps,
) {
  async function authorizedTeam(): Promise<string | null> {
    const access = await deps.authenticate()
    if (access.status !== 'authenticated') return null

    const teamId = await deps.resolveActiveTeam()
    if (!teamId) return null
    const decision = await deps.authorize(access, teamId)
    if (!decision.allowed || decision.teamId !== teamId) return null
    return teamId
  }

  async function ownsTemplate(teamId: string, templateId: string) {
    return deps.database.select({ id: workouts.id }).from(workouts).where(and(
      eq(workouts.id, templateId),
      eq(workouts.teamId, teamId),
      eq(workouts.isDeleted, false),
    )).get() !== undefined
  }

  return {
    async list(): Promise<Denied | Allowed<{ templates: Array<{ id: string }> }>> {
      const teamId = await authorizedTeam()
      if (!teamId) return { status: 'denied' }
      const templates = deps.database.select({ id: workouts.id })
        .from(workouts)
        .where(and(eq(workouts.teamId, teamId), eq(workouts.isDeleted, false)))
        .orderBy(workouts.id)
        .all()
      return { status: 'allowed', templates }
    },

    async archive(templateId: string, archived: boolean): Promise<Denied | Allowed<{}>> {
      const teamId = await authorizedTeam()
      if (!teamId || !(await ownsTemplate(teamId, templateId))) return { status: 'denied' }
      const changed = setWorkoutTemplateArchiveStatusRecord({
        id: templateId, teamId, archived, database: deps.database,
      })
      return changed ? { status: 'allowed' } : { status: 'denied' }
    },

    async duplicate(sourceId: string, duplicateId: string): Promise<Denied | Allowed<{}>> {
      const teamId = await authorizedTeam()
      if (!teamId || !(await ownsTemplate(teamId, sourceId))) return { status: 'denied' }
      const copied = duplicateWorkoutTemplateRecord({
        sourceId, duplicateId, teamId, titlePrefix: 'Copia de', database: deps.database,
      })
      return copied ? { status: 'allowed' } : { status: 'denied' }
    },
  }
}
