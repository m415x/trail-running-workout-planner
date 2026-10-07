import { and, eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { z } from 'zod'

import { athleteGroups, athleteProfiles } from '@/db/schema'
import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'
import type { H4aActiveTeamAuthorizationRequest } from '@/lib/authorization/h4a-active-team-authorization'
import { assignAthleteToGroupSynchronously } from '@/lib/athletes/group-assignment'

export interface AthleteGroupFormState {
  error?: string
}

const locales = ['es', 'en'] as const

const athleteGroupFormSchema = z.object({
  athleteId: z.string().trim().min(1, 'No se pudo identificar al atleta'),
  newGroupId: z.string().trim().min(1, 'Seleccioná un grupo'),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingresá una fecha válida'),
  reason: z.string().trim().max(500, 'El motivo no puede superar los 500 caracteres').optional(),
  locale: z.enum(locales).default('es'),
  returnContext: z.string().regex(/^group:[A-Za-z0-9_-]+$/).optional(),
})

function athletesPath(locale: string) {
  return locale === 'es' ? '/dashboard/athletes' : `/${locale}/dashboard/athletes`
}

function groupsPath(locale: string) {
  return locale === 'es' ? '/dashboard/groups' : `/${locale}/dashboard/groups`
}

export function createAthleteGroupAssignmentAction<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(dependencies: {
  db: BetterSQLite3Database<TSchema>
  requireAccess: () => Promise<RequireAuthenticatedActionResult>
  authorize: (
    access: RequireAuthenticatedActionResult,
    request: H4aActiveTeamAuthorizationRequest,
  ) => Promise<{ allowed: false } | { allowed: boolean; teamId: string }>
  createId: () => string
  now: () => string
  today: () => string
  revalidatePath: (path: string) => void
  redirect: (path: string) => void
}) {
  return async function assignAthleteToGroupAction(
    _previousState: AthleteGroupFormState,
    formData: FormData,
  ): Promise<AthleteGroupFormState> {
    const parsed = athleteGroupFormSchema.safeParse(Object.fromEntries(formData))

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Revisá los datos ingresados' }
    }

    const data = parsed.data
    const returnGroupId = data.returnContext?.startsWith('group:')
      ? data.returnContext.slice('group:'.length)
      : null

    try {
      const access = await dependencies.requireAccess()
      if (access.status !== 'authenticated') {
        return { error: 'No autorizado' }
      }

      const athlete = dependencies.db
        .select({
          id: athleteProfiles.id,
          teamId: athleteProfiles.teamId,
        })
        .from(athleteProfiles)
        .where(and(
          eq(athleteProfiles.id, data.athleteId),
          eq(athleteProfiles.isDeleted, false),
        ))
        .limit(1)
        .get()

      if (!athlete) {
        return { error: 'Atleta no encontrado' }
      }

      const newGroup = dependencies.db
        .select({
          id: athleteGroups.id,
          teamId: athleteGroups.teamId,
        })
        .from(athleteGroups)
        .where(and(
          eq(athleteGroups.id, data.newGroupId),
          eq(athleteGroups.isActive, true),
          eq(athleteGroups.isDeleted, false),
        ))
        .limit(1)
        .get()

      if (!newGroup || newGroup.teamId !== athlete.teamId) {
        return { error: 'Grupo no encontrado o inactivo' }
      }

      const athleteAuthorization = await dependencies.authorize(access, {
        capability: 'athlete.admin.manage',
        resource: { teamId: athlete.teamId },
        at: dependencies.now(),
        requiredScope: 'team',
      })
      if (!athleteAuthorization.allowed || !('teamId' in athleteAuthorization)) {
        return { error: 'No autorizado' }
      }

      const groupAuthorization = await dependencies.authorize(access, {
        capability: 'sporting_group.admin.manage',
        resource: { teamId: newGroup.teamId },
        at: dependencies.now(),
        requiredScope: 'team',
      })
      if (!groupAuthorization.allowed || !('teamId' in groupAuthorization)) {
        return { error: 'No autorizado' }
      }

      if (athleteAuthorization.teamId !== groupAuthorization.teamId) {
        return { error: 'No autorizado' }
      }

      assignAthleteToGroupSynchronously({
        db: dependencies.db,
        createId: dependencies.createId,
        now: dependencies.now,
        input: {
          teamId: groupAuthorization.teamId,
          athleteId: data.athleteId,
          newGroupId: data.newGroupId,
          effectiveDate: data.effectiveDate,
          today: dependencies.today(),
          reason: data.reason || null,
          changedByUserId: access.userId,
        },
      })
    } catch (error) {
      console.error('Error assigning athlete to group:', error)
      return { error: 'No se pudo cambiar el grupo' }
    }

    const listPath = athletesPath(data.locale)
    const detailPath = `${listPath}/${data.athleteId}`

    dependencies.revalidatePath(listPath)
    dependencies.revalidatePath(detailPath)

    if (returnGroupId === data.newGroupId) {
      const groupListPath = groupsPath(data.locale)
      const groupDetailPath = `${groupListPath}/${returnGroupId}`
      dependencies.revalidatePath(groupListPath)
      dependencies.revalidatePath(groupDetailPath)
      dependencies.redirect(groupDetailPath)
      return {}
    }

    dependencies.redirect(detailPath)

    return {}
  }
}
