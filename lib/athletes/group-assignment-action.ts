import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { z } from 'zod'

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
  teamId: string
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

    try {
      assignAthleteToGroupSynchronously({
        db: dependencies.db,
        createId: dependencies.createId,
        now: dependencies.now,
        input: {
          teamId: dependencies.teamId,
          athleteId: data.athleteId,
          newGroupId: data.newGroupId,
          effectiveDate: data.effectiveDate,
          today: dependencies.today(),
          reason: data.reason || null,
          changedByUserId: null,
        },
      })
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'No se pudo cambiar el grupo' }
    }

    const listPath = athletesPath(data.locale)
    const detailPath = `${listPath}/${data.athleteId}`
    const returnGroupId = data.returnContext?.startsWith('group:')
      ? data.returnContext.slice('group:'.length)
      : null

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
