'use server'

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { db } from '@/db'
import { sessions, trainingLocations, workouts } from '@/db/schema'

const CURRENT_TEAM_ID = 'team_1'
const workoutTypes = ['Base', 'Long', 'Intervals', 'Trail', 'Speed', 'Fartlek', 'PAM', 'Hills', 'Rest', 'Race'] as const
const optionalText = z.string().trim().transform((value) => value || null)

const createSessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingresá una fecha válida'),
  title: z.string().trim().min(2, 'El título debe tener al menos 2 caracteres'),
  type: z.enum(workoutTypes, { message: 'Seleccioná un tipo de entrenamiento' }),
  workoutId: optionalText,
  locationKey: optionalText,
  trackPath: optionalText,
  notes: optionalText,
  locale: z.string().trim().default('es'),
})

export interface SessionFormState { error?: string }

function sessionsPath(locale: string) {
  return locale === 'es' ? '/dashboard/sessions' : `/${locale}/dashboard/sessions`
}

export async function getSessionsByTeam(teamId: string = CURRENT_TEAM_ID) {
  return db.query.sessions.findMany({
    where: and(eq(sessions.teamId, teamId), eq(sessions.isDeleted, false)),
    with: {
      location: true,
    },
    orderBy: (table, { asc }) => [asc(table.date), asc(table.title)],
  })
}

export async function getSessionFormOptions() {
  const workoutOptions = db.query.workouts.findMany({
    where: eq(workouts.isDeleted, false),
    orderBy: (table, { asc }) => [asc(table.title)],
  }).sync()
  const locationOptions = db.select().from(trainingLocations).orderBy(trainingLocations.name).all()
  return { workouts: workoutOptions, locations: locationOptions }
}

export async function createSession(_previousState: SessionFormState, formData: FormData): Promise<SessionFormState> {
  const parsed = createSessionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Revisá los datos ingresados' }

  const data = parsed.data

  try {
    if (data.workoutId) {
      const workout = db.query.workouts.findFirst({
        where: and(eq(workouts.id, data.workoutId), eq(workouts.isDeleted, false)),
      }).sync()
      if (!workout) return { error: 'La plantilla de entrenamiento seleccionada no existe' }
    }

    if (data.locationKey) {
      const location = db.query.trainingLocations.findFirst({ where: eq(trainingLocations.key, data.locationKey) }).sync()
      if (!location) return { error: 'La ubicación seleccionada no existe' }
    }

    const now = new Date().toISOString()
    db.insert(sessions).values({
      id: randomUUID(), teamId: CURRENT_TEAM_ID, workoutId: data.workoutId,
      date: data.date, title: data.title, type: data.type, locationKey: data.locationKey,
      trackPath: data.trackPath, notes: data.notes, createdAt: now, updatedAt: now,
    }).run()
  } catch (error) {
    console.error('Error creating session:', error)
    return { error: error instanceof Error ? error.message : 'No se pudo crear la sesión' }
  }

  const path = sessionsPath(data.locale)
  revalidatePath(path)
  redirect(path)
}
