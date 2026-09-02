'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { db } from '@/db'
import { athleteGroups, groupTrainingPlans, microcycles } from '@/db/schema'

const CURRENT_TEAM_ID = 'team_1'
const locales = ['es', 'en'] as const

const updateMicrocycleVolumeSchema = z.object({
  microcycleId: z.string().trim().min(1, 'No se pudo identificar el microciclo'),
  planId: z.string().trim().min(1, 'No se pudo identificar la planificación'),
  targetVolumeKm: z.coerce.number().positive('El volumen debe ser mayor que cero').max(1000, 'El volumen no puede superar los 1000 km'),
  locale: z.enum(locales).default('es'),
})

export interface MicrocycleVolumeFormState {
  error?: string
}

function planningPath(locale: string, suffix = '') {
  const base = locale === 'es' ? '/dashboard/planning' : `/${locale}/dashboard/planning`
  return `${base}${suffix}`
}

export async function getGroupTrainingPlans() {
  const groups = await db.query.athleteGroups.findMany({
    where: and(
      eq(athleteGroups.teamId, CURRENT_TEAM_ID),
      eq(athleteGroups.isDeleted, false),
    ),
  })

  if (groups.length === 0) return []

  const plans = await db.query.groupTrainingPlans.findMany({
    where: and(
      inArray(groupTrainingPlans.groupId, groups.map((group) => group.id)),
      eq(groupTrainingPlans.isDeleted, false),
    ),
    with: {
      group: true,
      macrocycles: {
        with: {
          mesocycles: {
            with: {
              microcycles: true,
            },
          },
        },
      },
    },
  })

  return plans.sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
}

export async function getGroupTrainingPlanById(planId: string) {
  const plan = await db.query.groupTrainingPlans.findFirst({
    where: and(
      eq(groupTrainingPlans.id, planId),
      eq(groupTrainingPlans.isDeleted, false),
    ),
    with: {
      group: true,
      macrocycles: {
        with: {
          mesocycles: {
            with: {
              microcycles: true,
            },
          },
        },
      },
    },
  })

  if (!plan || plan.group.teamId !== CURRENT_TEAM_ID || plan.group.isDeleted) {
    return null
  }

  plan.macrocycles.sort((first, second) => first.startDate.localeCompare(second.startDate))
  plan.macrocycles.forEach((macrocycle) => {
    macrocycle.mesocycles.sort((first, second) => first.number - second.number)
    macrocycle.mesocycles.forEach((mesocycle) => {
      mesocycle.microcycles.sort((first, second) => first.weekNumber - second.weekNumber)
    })
  })

  return plan
}

export async function updateMicrocycleVolume(
  _previousState: MicrocycleVolumeFormState,
  formData: FormData,
): Promise<MicrocycleVolumeFormState> {
  const parsed = updateMicrocycleVolumeSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisá el volumen ingresado' }
  }

  const data = parsed.data

  try {
    const microcycle = db.query.microcycles.findFirst({
      where: and(
        eq(microcycles.id, data.microcycleId),
        eq(microcycles.isDeleted, false),
      ),
      with: {
        mesocycle: {
          with: {
            macrocycle: {
              with: {
                groupTrainingPlan: {
                  with: {
                    group: true,
                  },
                },
              },
            },
          },
        },
      },
    }).sync()

    const plan = microcycle?.mesocycle.macrocycle.groupTrainingPlan

    if (
      !microcycle
      || !plan
      || plan.id !== data.planId
      || plan.isDeleted
      || plan.group.teamId !== CURRENT_TEAM_ID
      || plan.group.isDeleted
    ) {
      return { error: 'Microciclo no encontrado' }
    }

    const now = new Date().toISOString()

    db.transaction((tx) => {
      tx.update(microcycles)
        .set({
          targetVolumeKm: data.targetVolumeKm,
          updatedAt: now,
        })
        .where(and(eq(microcycles.id, microcycle.id), eq(microcycles.isDeleted, false)))
        .run()

      tx.update(groupTrainingPlans)
        .set({ updatedAt: now })
        .where(eq(groupTrainingPlans.id, plan.id))
        .run()
    })
  } catch (error) {
    console.error('Error updating microcycle volume:', error)
    return { error: 'No se pudo actualizar el volumen' }
  }

  const detailPath = planningPath(data.locale, `/${data.planId}`)
  revalidatePath(planningPath(data.locale))
  revalidatePath(detailPath)
  redirect(detailPath)
}
