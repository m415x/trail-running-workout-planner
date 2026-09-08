'use server'

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { db } from '@/db'
import { sessionGenerationPreferences } from '@/db/session-generation-preferences-schema'
import { athleteGroups, groupTrainingPlans } from '@/db/schema'
import {
  buildWeeklyTrainingPattern,
  defaultWeeklyGenerationPreferences,
  parseWeeklySessionFrequency,
} from '@/lib/session-generation/generation-preferences'
import {
  resolveSessionGenerationPreferences,
  serializeSessionGenerationPreferences,
} from '@/lib/session-generation/generation-preferences-persistence'

const CURRENT_TEAM_ID = 'team_1'
const locales = ['es', 'en'] as const

const updatePreferencesSchema = z.object({
  planId: z.string().trim().min(1),
  locale: z.enum(locales).default('es'),
  fixedSessionsPerWeek: z.string(),
  weeklyPattern: z.string(),
})

export interface SessionGenerationPreferencesFormState {
  error?: string
  success?: string
}

function planningPath(locale: string, planId: string) {
  const base = locale === 'es' ? '/dashboard/planning' : `/${locale}/dashboard/planning`
  return `${base}/${planId}`
}

function getEditablePlan(planId: string) {
  return db.select({
    id: groupTrainingPlans.id,
  })
    .from(groupTrainingPlans)
    .innerJoin(athleteGroups, eq(groupTrainingPlans.groupId, athleteGroups.id))
    .where(and(
      eq(groupTrainingPlans.id, planId),
      eq(groupTrainingPlans.isDeleted, false),
      eq(athleteGroups.teamId, CURRENT_TEAM_ID),
      eq(athleteGroups.isDeleted, false),
    ))
    .get()
}

export async function getSessionGenerationPreferencesForPlan(planId: string) {
  if (!getEditablePlan(planId)) return null

  const stored = db.query.sessionGenerationPreferences.findFirst({
    where: and(
      eq(sessionGenerationPreferences.groupTrainingPlanId, planId),
      eq(sessionGenerationPreferences.isDeleted, false),
    ),
  }).sync()

  return resolveSessionGenerationPreferences(stored
    ? {
        frequencyMode: stored.frequencyMode,
        fixedSessionsPerWeek: stored.fixedSessionsPerWeek,
        weeklyPattern: stored.weeklyPattern,
      }
    : null)
}

export async function updateSessionGenerationPreferences(
  _previousState: SessionGenerationPreferencesFormState,
  formData: FormData,
): Promise<SessionGenerationPreferencesFormState> {
  const parsed = updatePreferencesSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { error: 'Revisá la configuración semanal antes de guardar' }
  }

  const data = parsed.data
  if (!getEditablePlan(data.planId)) {
    return { error: 'La planificación no está disponible' }
  }

  let rawPattern: unknown
  try {
    rawPattern = JSON.parse(data.weeklyPattern)
  } catch {
    return { error: 'No se pudo interpretar el patrón semanal' }
  }

  if (!Array.isArray(rawPattern)) {
    return { error: 'El patrón semanal no es válido' }
  }

  try {
    const frequency = parseWeeklySessionFrequency(data.fixedSessionsPerWeek)
    const pattern = buildWeeklyTrainingPattern(rawPattern.map((slot) => ({
      weekday: String((slot as { weekday?: unknown }).weekday ?? ''),
      role: String((slot as { role?: unknown }).role ?? ''),
    })))
    const serialized = serializeSessionGenerationPreferences({ frequency, pattern })
    const existing = db.query.sessionGenerationPreferences.findFirst({
      where: eq(sessionGenerationPreferences.groupTrainingPlanId, data.planId),
    }).sync()
    const now = new Date().toISOString()

    db.transaction((tx) => {
      if (existing) {
        tx.update(sessionGenerationPreferences)
          .set({
            frequencyMode: serialized.frequencyMode,
            fixedSessionsPerWeek: serialized.fixedSessionsPerWeek,
            weeklyPattern: serialized.weeklyPattern,
            isDeleted: false,
            updatedAt: now,
          })
          .where(eq(sessionGenerationPreferences.id, existing.id))
          .run()
      } else {
        const defaults = defaultWeeklyGenerationPreferences()
        const fallback = serializeSessionGenerationPreferences(defaults)

        tx.insert(sessionGenerationPreferences).values({
          id: randomUUID(),
          groupTrainingPlanId: data.planId,
          frequencyMode: serialized.frequencyMode ?? fallback.frequencyMode,
          fixedSessionsPerWeek: serialized.fixedSessionsPerWeek,
          weeklyPattern: serialized.weeklyPattern,
          createdAt: now,
          updatedAt: now,
        }).run()
      }
    })
  } catch (error) {
    return {
      error: error instanceof Error
        ? error.message
        : 'No se pudo guardar la configuración semanal',
    }
  }

  revalidatePath(planningPath(data.locale, data.planId))
  return { success: 'Configuración semanal guardada' }
}
