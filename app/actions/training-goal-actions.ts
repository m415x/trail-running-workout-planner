'use server'

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { db } from '@/db'
import { athleteProfiles, trainingGoals } from '@/db/schema'

const CURRENT_TEAM_ID = 'team_1'
const goalTypes = ['race', 'performance', 'base', 'maintenance', 'custom'] as const
const locales = ['es', 'en'] as const

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

const trainingGoalFormSchema = z.object({
  athleteId: z.string().trim().min(1, 'No se pudo identificar al atleta'),
  type: z.enum(goalTypes, 'Seleccioná un tipo de objetivo'),
  title: z.string().trim().min(3, 'Ingresá un título de al menos 3 caracteres').max(120, 'El título no puede superar los 120 caracteres'),
  description: z.string().trim().max(1000, 'La descripción no puede superar los 1000 caracteres').optional(),
  targetDate: z.string().trim().optional(),
  raceName: z.string().trim().max(120, 'El nombre de la carrera no puede superar los 120 caracteres').optional(),
  raceDistanceKm: z.string().trim().optional(),
  raceElevationGain: z.string().trim().optional(),
  notes: z.string().trim().max(2000, 'Las notas no pueden superar los 2000 caracteres').optional(),
  locale: z.enum(locales).default('es'),
}).superRefine((data, context) => {
  if (data.targetDate && !isValidIsoDate(data.targetDate)) {
    context.addIssue({ code: 'custom', path: ['targetDate'], message: 'Ingresá una fecha válida' })
  }

  if (data.type !== 'race') return

  if (!data.raceName) {
    context.addIssue({ code: 'custom', path: ['raceName'], message: 'Ingresá el nombre de la carrera' })
  }

  if (!data.targetDate) {
    context.addIssue({ code: 'custom', path: ['targetDate'], message: 'Ingresá la fecha de la carrera' })
  }

  const distance = Number(data.raceDistanceKm)
  if (!data.raceDistanceKm || !Number.isFinite(distance) || distance <= 0) {
    context.addIssue({ code: 'custom', path: ['raceDistanceKm'], message: 'Ingresá una distancia mayor que cero' })
  }

  if (data.raceElevationGain) {
    const elevationGain = Number(data.raceElevationGain)
    if (!Number.isInteger(elevationGain) || elevationGain < 0) {
      context.addIssue({ code: 'custom', path: ['raceElevationGain'], message: 'Ingresá un desnivel válido' })
    }
  }
})

export interface TrainingGoalFormState {
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
}

function athleteDetailPath(locale: string, athleteId: string) {
  const base = locale === 'es' ? '/dashboard/athletes' : `/${locale}/dashboard/athletes`
  return `${base}/${athleteId}`
}

export async function createTrainingGoal(
  _previousState: TrainingGoalFormState,
  formData: FormData,
): Promise<TrainingGoalFormState> {
  const parsed = trainingGoalFormSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return {
      error: 'Revisá los campos marcados antes de continuar',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  const data = parsed.data

  try {
    const athlete = db.query.athleteProfiles.findFirst({
      where: and(
        eq(athleteProfiles.id, data.athleteId),
        eq(athleteProfiles.teamId, CURRENT_TEAM_ID),
        eq(athleteProfiles.isDeleted, false),
      ),
    }).sync()

    if (!athlete) {
      return { error: 'Atleta no encontrado' }
    }

    const isRaceGoal = data.type === 'race'
    const now = new Date().toISOString()

    db.insert(trainingGoals).values({
      id: randomUUID(),
      athleteId: athlete.id,
      type: data.type,
      status: 'draft',
      title: data.title,
      description: data.description || null,
      targetDate: data.targetDate || null,
      raceName: isRaceGoal ? data.raceName || null : null,
      raceDistanceKm: isRaceGoal ? Number(data.raceDistanceKm) : null,
      raceElevationGain: isRaceGoal && data.raceElevationGain ? Number(data.raceElevationGain) : null,
      notes: data.notes || null,
      createdAt: now,
      updatedAt: now,
    }).run()
  } catch (error) {
    console.error('Error creating training goal:', error)
    return { error: 'No se pudo crear el objetivo de entrenamiento' }
  }

  const path = athleteDetailPath(data.locale, data.athleteId)
  revalidatePath(path)
  redirect(path)
}
