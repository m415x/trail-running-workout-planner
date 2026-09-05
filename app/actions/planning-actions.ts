'use server'

import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { differenceInCalendarDays, isValid, parseISO } from 'date-fns'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { db } from '@/db'
import { loadStrategies } from '@/db/load-strategy-schema'
import {
  athleteGroups,
  groupTrainingPlans,
  macrocycles,
  microcycles,
  planningModificationRecords,
} from '@/db/schema'
import {
  buildLoadProgressionPreview,
  determineTrainingProgressionEndDate,
} from '@/lib/periodization/load-progression-preview'
import { persistProgression } from '@/lib/periodization/progression-persistence'
import type { AthleteGroupCode, LoadStrategyDraft } from '@/types'

const CURRENT_TEAM_ID = 'team_1'
const locales = ['es', 'en'] as const
const microcycleTypes = ['base', 'development', 'shock', 'deload', 'tapering', 'race'] as const

const persistProgressionSchema = z.object({
  planId: z.string().trim().min(1, 'No se pudo identificar la planificación'),
  macrocycleId: z.string().trim().min(1, 'No se pudo identificar el macrociclo'),
  locale: z.enum(locales).default('es'),
})

const updateMicrocycleVolumeSchema = z.object({
  microcycleId: z.string().trim().min(1, 'No se pudo identificar el microciclo'),
  planId: z.string().trim().min(1, 'No se pudo identificar la planificación'),
  targetVolumeKm: z.coerce.number().positive('El volumen debe ser mayor que cero').max(1000, 'El volumen no puede superar los 1000 km'),
  locale: z.enum(locales).default('es'),
})

const updateMicrocycleElevationSchema = z.object({
  microcycleId: z.string().trim().min(1, 'No se pudo identificar el microciclo'),
  planId: z.string().trim().min(1, 'No se pudo identificar la planificación'),
  targetElevationGain: z.preprocess(
    (value) => value === '' ? null : value,
    z.coerce.number()
      .int('El desnivel debe expresarse en metros enteros')
      .min(0, 'El desnivel no puede ser negativo')
      .max(100_000, 'El desnivel no puede superar los 100.000 m')
      .nullable(),
  ),
  locale: z.enum(locales).default('es'),
})

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value))
}

const updateMicrocycleDatesSchema = z.object({
  microcycleId: z.string().trim().min(1, 'No se pudo identificar el microciclo'),
  planId: z.string().trim().min(1, 'No se pudo identificar la planificación'),
  startDate: z.string().refine(isValidIsoDate, 'Ingresá una fecha inicial válida'),
  endDate: z.string().refine(isValidIsoDate, 'Ingresá una fecha final válida'),
  locale: z.enum(locales).default('es'),
})

const updateMicrocycleTypeSchema = z.object({
  microcycleId: z.string().trim().min(1, 'No se pudo identificar el microciclo'),
  planId: z.string().trim().min(1, 'No se pudo identificar la planificación'),
  type: z.enum(microcycleTypes, 'Seleccioná un tipo de microciclo'),
  locale: z.enum(locales).default('es'),
})

const updateMicrocycleNotesSchema = z.object({
  microcycleId: z.string().trim().min(1, 'No se pudo identificar el microciclo'),
  planId: z.string().trim().min(1, 'No se pudo identificar la planificación'),
  notes: z.string().trim().max(2000, 'Las notas no pueden superar los 2000 caracteres'),
  locale: z.enum(locales).default('es'),
})

export interface MicrocycleVolumeFormState {
  error?: string
}

export interface MicrocycleElevationFormState {
  error?: string
}

export interface MicrocycleDatesFormState {
  error?: string
}

export interface MicrocycleTypeFormState {
  error?: string
}

export interface MicrocycleNotesFormState {
  error?: string
}

export interface PersistProgressionFormState {
  error?: string
}

function planningPath(locale: string, suffix = '') {
  const base = locale === 'es' ? '/dashboard/planning' : `/${locale}/dashboard/planning`
  return `${base}${suffix}`
}

function getEditableMicrocycle(microcycleId: string) {
  return db.query.microcycles.findFirst({
    where: and(
      eq(microcycles.id, microcycleId),
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
}

function belongsToEditablePlan(
  microcycle: ReturnType<typeof getEditableMicrocycle>,
  planId: string,
) {
  const plan = microcycle?.mesocycle.macrocycle.groupTrainingPlan

  return Boolean(
    microcycle
    && plan
    && plan.id === planId
    && !plan.isDeleted
    && plan.group.teamId === CURRENT_TEAM_ID
    && !plan.group.isDeleted,
  )
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

  const loadStrategy = db.query.loadStrategies.findFirst({
    where: and(
      eq(loadStrategies.groupTrainingPlanId, plan.id),
      eq(loadStrategies.isDeleted, false),
    ),
  }).sync()

  plan.macrocycles.sort((first, second) => first.startDate.localeCompare(second.startDate))
  plan.macrocycles = plan.macrocycles.filter((macrocycle) => !macrocycle.isDeleted)
  plan.macrocycles.forEach((macrocycle) => {
    macrocycle.mesocycles = macrocycle.mesocycles.filter((mesocycle) => !mesocycle.isDeleted)
    macrocycle.mesocycles.sort((first, second) => first.number - second.number)
    macrocycle.mesocycles.forEach((mesocycle) => {
      mesocycle.microcycles = mesocycle.microcycles.filter((microcycle) => !microcycle.isDeleted)
      mesocycle.microcycles.sort((first, second) => first.weekNumber - second.weekNumber)
    })
  })

  return { ...plan, loadStrategy: loadStrategy ?? null }
}

export async function saveLoadProgression(
  _previousState: PersistProgressionFormState,
  formData: FormData,
): Promise<PersistProgressionFormState> {
  const parsed = persistProgressionSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'No se pudo guardar la progresión' }
  }

  const data = parsed.data

  try {
    const plan = await getGroupTrainingPlanById(data.planId)
    const macrocycle = plan?.macrocycles.find((candidate) => candidate.id === data.macrocycleId)

    if (!plan || !macrocycle || !plan.loadStrategy) {
      return { error: 'El plan no tiene una estrategia y un macrociclo válidos' }
    }

    const athleteGroup = `${plan.group.categoryCode}${plan.group.levelCode}` as AthleteGroupCode
    const loadStrategy: LoadStrategyDraft = {
      context: {
        athleteGroup,
        goalType: plan.loadStrategy.goalType,
      },
      values: {
        initialWeeklyVolumeKm: plan.loadStrategy.initialWeeklyVolumeKm,
        maximumWeeklyVolumeKm: plan.loadStrategy.maximumWeeklyVolumeKm,
        sessionsPerWeek: plan.loadStrategy.sessionsPerWeek,
        maximumWeeklyIncreasePercentage: plan.loadStrategy.maximumWeeklyIncreasePercentage,
        deloadPercentage: plan.loadStrategy.deloadPercentage,
        initialWeeklyElevationGain: plan.loadStrategy.initialWeeklyElevationGain,
        maximumWeeklyElevationGain: plan.loadStrategy.maximumWeeklyElevationGain,
      },
      fieldSources: plan.loadStrategy.fieldSources,
    }
    const protectedMesocycles = macrocycle.mesocycles.filter((mesocycle) => (
      mesocycle.period === 'competitive' || mesocycle.period === 'transition'
    ))
    const trainingEndDate = determineTrainingProgressionEndDate(
      macrocycle.endDate,
      protectedMesocycles.flatMap((mesocycle) => (
        mesocycle.microcycles.map((microcycle) => microcycle.startDate)
      )),
    )
    const existingMicrocycles = macrocycle.mesocycles
      .filter((mesocycle) => !protectedMesocycles.includes(mesocycle))
      .flatMap((mesocycle) => mesocycle.microcycles.map((microcycle) => ({
        id: microcycle.id,
        weekNumber: microcycle.weekNumber,
        targetVolumeKm: microcycle.targetVolumeKm,
        targetVolumeSource: microcycle.targetVolumeSource,
        targetElevationGain: microcycle.targetElevationGain,
        targetElevationSource: microcycle.targetElevationSource,
      })))
    const preview = buildLoadProgressionPreview({
      title: macrocycle.title,
      startDate: macrocycle.startDate,
      endDate: trainingEndDate,
      loadStrategy,
      targetRace: macrocycle.targetRaceName && macrocycle.targetRaceDistanceKm
        ? {
            name: macrocycle.targetRaceName,
            distanceKm: macrocycle.targetRaceDistanceKm,
            ...(macrocycle.targetRaceElevationGain === null
              ? {}
              : { elevationGain: macrocycle.targetRaceElevationGain }),
          }
        : null,
      existingMicrocycles,
    })

    if (preview.conflicts.length > 0) {
      return { error: preview.conflicts[0].message }
    }

    persistProgression({
      groupTrainingPlanId: plan.id,
      macrocycleId: macrocycle.id,
      planning: preview.planning,
    })
  } catch (error) {
    console.error('Error saving load progression:', error)
    return { error: error instanceof Error ? error.message : 'No se pudo guardar la progresión' }
  }

  const detailPath = planningPath(data.locale, `/${data.planId}`)
  revalidatePath(planningPath(data.locale))
  revalidatePath(detailPath)
  redirect(detailPath)
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
    const microcycle = getEditableMicrocycle(data.microcycleId)
    const plan = microcycle?.mesocycle.macrocycle.groupTrainingPlan

    if (!microcycle || !plan || !belongsToEditablePlan(microcycle, data.planId)) {
      return { error: 'Microciclo no encontrado' }
    }

    if (microcycle.targetVolumeKm !== data.targetVolumeKm) {
      const now = new Date().toISOString()

      db.transaction((tx) => {
        tx.update(microcycles)
          .set({
            targetVolumeKm: data.targetVolumeKm,
            targetVolumeSource: 'manual',
            updatedAt: now,
          })
          .where(and(eq(microcycles.id, microcycle.id), eq(microcycles.isDeleted, false)))
          .run()

        tx.update(groupTrainingPlans)
          .set({ updatedAt: now })
          .where(eq(groupTrainingPlans.id, plan.id))
          .run()

        tx.insert(planningModificationRecords).values({
          id: randomUUID(),
          groupTrainingPlanId: plan.id,
          microcycleId: microcycle.id,
          field: 'target_volume_km',
          previousValue: microcycle.targetVolumeKm?.toString() ?? null,
          newValue: data.targetVolumeKm.toString(),
          changedByUserId: null,
          createdAt: now,
          updatedAt: now,
        }).run()
      })
    }
  } catch (error) {
    console.error('Error updating microcycle volume:', error)
    return { error: 'No se pudo actualizar el volumen' }
  }

  const detailPath = planningPath(data.locale, `/${data.planId}`)
  revalidatePath(planningPath(data.locale))
  revalidatePath(detailPath)
  redirect(detailPath)
}

export async function updateMicrocycleElevation(
  _previousState: MicrocycleElevationFormState,
  formData: FormData,
): Promise<MicrocycleElevationFormState> {
  const parsed = updateMicrocycleElevationSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisá el desnivel ingresado' }
  }

  const data = parsed.data

  try {
    const microcycle = getEditableMicrocycle(data.microcycleId)
    const plan = microcycle?.mesocycle.macrocycle.groupTrainingPlan

    if (!microcycle || !plan || !belongsToEditablePlan(microcycle, data.planId)) {
      return { error: 'Microciclo no encontrado' }
    }

    if (
      microcycle.targetElevationGain !== data.targetElevationGain
      || microcycle.targetElevationSource !== 'manual'
    ) {
      const now = new Date().toISOString()

      db.transaction((tx) => {
        tx.update(microcycles)
          .set({
            targetElevationGain: data.targetElevationGain,
            targetElevationSource: 'manual',
            updatedAt: now,
          })
          .where(and(eq(microcycles.id, microcycle.id), eq(microcycles.isDeleted, false)))
          .run()

        tx.update(groupTrainingPlans)
          .set({ updatedAt: now })
          .where(eq(groupTrainingPlans.id, plan.id))
          .run()

        tx.insert(planningModificationRecords).values({
          id: randomUUID(),
          groupTrainingPlanId: plan.id,
          microcycleId: microcycle.id,
          field: 'target_elevation_gain',
          previousValue: microcycle.targetElevationGain?.toString() ?? null,
          newValue: data.targetElevationGain?.toString() ?? null,
          changedByUserId: null,
          createdAt: now,
          updatedAt: now,
        }).run()
      })
    }
  } catch (error) {
    console.error('Error updating microcycle elevation:', error)
    return { error: 'No se pudo actualizar el desnivel' }
  }

  const detailPath = planningPath(data.locale, `/${data.planId}`)
  revalidatePath(planningPath(data.locale))
  revalidatePath(detailPath)
  redirect(detailPath)
}

export async function updateMicrocycleDates(
  _previousState: MicrocycleDatesFormState,
  formData: FormData,
): Promise<MicrocycleDatesFormState> {
  const parsed = updateMicrocycleDatesSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisá las fechas ingresadas' }
  }

  const data = parsed.data
  const start = parseISO(data.startDate)
  const end = parseISO(data.endDate)
  const durationDays = differenceInCalendarDays(end, start) + 1

  if (durationDays <= 0) {
    return { error: 'La fecha final debe ser igual o posterior a la inicial' }
  }

  if (durationDays > 7) {
    return { error: 'Un microciclo no puede superar los 7 días' }
  }

  try {
    const microcycle = getEditableMicrocycle(data.microcycleId)
    const macrocycle = microcycle?.mesocycle.macrocycle
    const plan = macrocycle?.groupTrainingPlan

    if (!microcycle || !macrocycle || !plan || !belongsToEditablePlan(microcycle, data.planId)) {
      return { error: 'Microciclo no encontrado' }
    }

    const macrocycleWithWeeks = db.query.macrocycles.findFirst({
      where: and(
        eq(macrocycles.id, macrocycle.id),
        eq(macrocycles.isDeleted, false),
      ),
      with: {
        mesocycles: {
          with: {
            microcycles: true,
          },
        },
      },
    }).sync()

    if (!macrocycleWithWeeks) {
      return { error: 'Macrociclo no encontrado' }
    }

    const otherMicrocycles = macrocycleWithWeeks.mesocycles
      .flatMap((mesocycle) => mesocycle.microcycles)
      .filter((candidate) => candidate.id !== microcycle.id && !candidate.isDeleted)
    const overlaps = otherMicrocycles.some(
      (candidate) => candidate.startDate <= data.endDate && candidate.endDate >= data.startDate,
    )

    if (overlaps) {
      return { error: 'Las fechas se superponen con otro microciclo' }
    }

    const allStartDates = [...otherMicrocycles.map((candidate) => candidate.startDate), data.startDate]
    const allEndDates = [...otherMicrocycles.map((candidate) => candidate.endDate), data.endDate]
    const macrocycleStartDate = allStartDates.sort()[0]
    const macrocycleEndDate = allEndDates.sort().at(-1)

    if (!macrocycleStartDate || !macrocycleEndDate) {
      return { error: 'No se pudieron calcular los límites del macrociclo' }
    }

    if (microcycle.startDate !== data.startDate || microcycle.endDate !== data.endDate) {
      const now = new Date().toISOString()

      db.transaction((tx) => {
        tx.update(microcycles)
          .set({
            startDate: data.startDate,
            endDate: data.endDate,
            updatedAt: now,
          })
          .where(and(eq(microcycles.id, microcycle.id), eq(microcycles.isDeleted, false)))
          .run()

        tx.update(macrocycles)
          .set({
            startDate: macrocycleStartDate,
            endDate: macrocycleEndDate,
            updatedAt: now,
          })
          .where(eq(macrocycles.id, macrocycle.id))
          .run()

        tx.update(groupTrainingPlans)
          .set({ updatedAt: now })
          .where(eq(groupTrainingPlans.id, plan.id))
          .run()

        tx.insert(planningModificationRecords).values({
          id: randomUUID(),
          groupTrainingPlanId: plan.id,
          microcycleId: microcycle.id,
          field: 'date_range',
          previousValue: JSON.stringify({ startDate: microcycle.startDate, endDate: microcycle.endDate }),
          newValue: JSON.stringify({ startDate: data.startDate, endDate: data.endDate }),
          changedByUserId: null,
          createdAt: now,
          updatedAt: now,
        }).run()
      })
    }
  } catch (error) {
    console.error('Error updating microcycle dates:', error)
    return { error: 'No se pudieron actualizar las fechas' }
  }

  const detailPath = planningPath(data.locale, `/${data.planId}`)
  revalidatePath(planningPath(data.locale))
  revalidatePath(detailPath)
  redirect(detailPath)
}

export async function updateMicrocycleType(
  _previousState: MicrocycleTypeFormState,
  formData: FormData,
): Promise<MicrocycleTypeFormState> {
  const parsed = updateMicrocycleTypeSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisá el tipo seleccionado' }
  }

  const data = parsed.data

  try {
    const microcycle = getEditableMicrocycle(data.microcycleId)
    const plan = microcycle?.mesocycle.macrocycle.groupTrainingPlan

    if (!microcycle || !plan || !belongsToEditablePlan(microcycle, data.planId)) {
      return { error: 'Microciclo no encontrado' }
    }

    if (microcycle.type !== data.type) {
      const now = new Date().toISOString()

      db.transaction((tx) => {
        tx.update(microcycles)
          .set({
            type: data.type,
            updatedAt: now,
          })
          .where(and(eq(microcycles.id, microcycle.id), eq(microcycles.isDeleted, false)))
          .run()

        tx.update(groupTrainingPlans)
          .set({ updatedAt: now })
          .where(eq(groupTrainingPlans.id, plan.id))
          .run()

        tx.insert(planningModificationRecords).values({
          id: randomUUID(),
          groupTrainingPlanId: plan.id,
          microcycleId: microcycle.id,
          field: 'type',
          previousValue: microcycle.type,
          newValue: data.type,
          changedByUserId: null,
          createdAt: now,
          updatedAt: now,
        }).run()
      })
    }
  } catch (error) {
    console.error('Error updating microcycle type:', error)
    return { error: 'No se pudo actualizar el tipo de microciclo' }
  }

  const detailPath = planningPath(data.locale, `/${data.planId}`)
  revalidatePath(planningPath(data.locale))
  revalidatePath(detailPath)
  redirect(detailPath)
}

export async function updateMicrocycleNotes(
  _previousState: MicrocycleNotesFormState,
  formData: FormData,
): Promise<MicrocycleNotesFormState> {
  const parsed = updateMicrocycleNotesSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisá las notas ingresadas' }
  }

  const data = parsed.data

  try {
    const microcycle = getEditableMicrocycle(data.microcycleId)
    const plan = microcycle?.mesocycle.macrocycle.groupTrainingPlan

    if (!microcycle || !plan || !belongsToEditablePlan(microcycle, data.planId)) {
      return { error: 'Microciclo no encontrado' }
    }

    const nextNotes = data.notes || null

    if (microcycle.notes !== nextNotes) {
      const now = new Date().toISOString()

      db.transaction((tx) => {
        tx.update(microcycles)
          .set({
            notes: nextNotes,
            updatedAt: now,
          })
          .where(and(eq(microcycles.id, microcycle.id), eq(microcycles.isDeleted, false)))
          .run()

        tx.update(groupTrainingPlans)
          .set({ updatedAt: now })
          .where(eq(groupTrainingPlans.id, plan.id))
          .run()

        tx.insert(planningModificationRecords).values({
          id: randomUUID(),
          groupTrainingPlanId: plan.id,
          microcycleId: microcycle.id,
          field: 'notes',
          previousValue: microcycle.notes,
          newValue: nextNotes,
          changedByUserId: null,
          createdAt: now,
          updatedAt: now,
        }).run()
      })
    }
  } catch (error) {
    console.error('Error updating microcycle notes:', error)
    return { error: 'No se pudieron actualizar las notas' }
  }

  const detailPath = planningPath(data.locale, `/${data.planId}`)
  revalidatePath(planningPath(data.locale))
  revalidatePath(detailPath)
  redirect(detailPath)
}
