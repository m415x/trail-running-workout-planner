'use server'

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { db } from '@/db'
import {
  athleteGroups,
  groupSessionPrescriptions,
  groupTrainingPlans,
  macrocycles,
  mesocycles,
  microcycles,
  sessions,
  trainingLocations,
  workouts,
} from '@/db/schema'

const CURRENT_TEAM_ID = 'team_1'
const workoutTypes = ['Base', 'Long', 'Intervals', 'Trail', 'Speed', 'Fartlek', 'PAM', 'Hills', 'Rest', 'Race'] as const
const optionalText = z.string().trim().transform((value) => value || null)
const optionalNumber = z.preprocess(
  (value) => value === '' || value == null ? null : Number(value),
  z.number().finite().min(0, 'Los valores de volumen no pueden ser negativos').nullable(),
)

const createSessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingresá una fecha válida'),
  title: z.string().trim().min(2, 'El título debe tener al menos 2 caracteres'),
  type: z.enum(workoutTypes, { message: 'Seleccioná un tipo de entrenamiento' }),
  workoutId: optionalText,
  locationKey: optionalText,
  trackPath: optionalText,
  preliminaryExercises: optionalText,
  warmup: optionalText,
  mainBlock: optionalText,
  cooldown: optionalText,
  notes: optionalText,
  locale: z.string().trim().default('es'),
})

const prescriptionSchema = z.object({
  groupId: z.string().trim().min(1),
  microcycleId: z.string().trim().min(1, 'Seleccioná un microciclo para cada grupo'),
  distanceKm: optionalNumber,
  durationMin: optionalNumber,
  elevationGain: optionalNumber,
  intensityMethod: z.enum(['hr_zone', 'pam_percentage']).nullable(),
  zone: z.enum(['Z1', 'Z2', 'Z3', 'Z4', 'Z5']).nullable(),
  pamPercentage: optionalNumber,
  notes: z.string().trim().transform((value) => value || null),
}).superRefine((data, context) => {
  if (data.intensityMethod === 'hr_zone' && !data.zone) {
    context.addIssue({ code: 'custom', path: ['zone'], message: 'Seleccioná una zona para la intensidad por FC' })
  }
  if (data.intensityMethod === 'pam_percentage') {
    if (data.pamPercentage == null || data.pamPercentage <= 0 || data.pamPercentage > 200) {
      context.addIssue({ code: 'custom', path: ['pamPercentage'], message: 'Ingresá un porcentaje PAM entre 0 y 200' })
    }
  }
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
      sessionPrescriptions: {
        columns: {
          groupId: true,
        },
      },
    },
    orderBy: (table, { asc }) => [asc(table.date), asc(table.title)],
  })
}

export async function getSessionById(sessionId: string) {
  return db.query.sessions.findFirst({
    where: and(
      eq(sessions.id, sessionId),
      eq(sessions.teamId, CURRENT_TEAM_ID),
      eq(sessions.isDeleted, false),
    ),
    with: {
      location: true,
      workout: true,
      sessionPrescriptions: {
        where: eq(groupSessionPrescriptions.isDeleted, false),
      },
    },
  })
}

export async function getSessionFormOptions() {
  const workoutOptions = db.query.workouts.findMany({
    where: eq(workouts.isDeleted, false),
    orderBy: (table, { asc }) => [asc(table.title)],
  }).sync()
  const locationOptions = db.select().from(trainingLocations).orderBy(trainingLocations.name).all()
  const groupRows = db.query.athleteGroups.findMany({
    where: and(
      eq(athleteGroups.teamId, CURRENT_TEAM_ID),
      eq(athleteGroups.isActive, true),
      eq(athleteGroups.isDeleted, false),
    ),
    orderBy: (table, { asc }) => [asc(table.categoryCode), asc(table.levelCode)],
    with: {
      trainingPlans: {
        where: eq(groupTrainingPlans.isDeleted, false),
        with: {
          macrocycles: {
            where: eq(macrocycles.isDeleted, false),
            with: {
              mesocycles: {
                where: eq(mesocycles.isDeleted, false),
                with: {
                  microcycles: {
                    where: eq(microcycles.isDeleted, false),
                  },
                },
              },
            },
          },
        },
      },
    },
  }).sync()

  const groups = groupRows.map((group) => ({
    id: group.id,
    code: `${group.categoryCode}${group.levelCode}`,
    microcycles: group.trainingPlans.flatMap((plan) => plan.macrocycles.flatMap((macrocycle) =>
      macrocycle.mesocycles.flatMap((mesocycle) => mesocycle.microcycles.map((microcycle) => ({
        id: microcycle.id,
        label: `${plan.title} · Semana ${microcycle.weekNumber} · ${microcycle.startDate} al ${microcycle.endDate}`,
      }))),
    )),
  }))

  return { workouts: workoutOptions, locations: locationOptions, groups }
}

export async function createSession(_previousState: SessionFormState, formData: FormData): Promise<SessionFormState> {
  const parsed = createSessionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Revisá los datos ingresados' }

  const prescriptions = parsePrescriptions(formData)
  if (!prescriptions.success) return { error: prescriptions.error }

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

    const structure = data.preliminaryExercises || data.warmup || data.mainBlock || data.cooldown
      ? {
          preliminaryExercises: data.preliminaryExercises,
          warmup: data.warmup,
          mainBlock: data.mainBlock,
          cooldown: data.cooldown,
        }
      : null

    const referenceError = validatePrescriptionReferences(prescriptions.data)
    if (referenceError) return { error: referenceError }

    const now = new Date().toISOString()
    const sessionId = randomUUID()
    db.transaction((tx) => {
      tx.insert(sessions).values({
        id: sessionId, teamId: CURRENT_TEAM_ID, workoutId: data.workoutId,
        date: data.date, title: data.title, type: data.type, locationKey: data.locationKey,
        trackPath: data.trackPath, structure, notes: data.notes, createdAt: now, updatedAt: now,
      }).run()

      tx.insert(groupSessionPrescriptions).values(prescriptions.data.map((prescription) => ({
        id: randomUUID(), sessionId, ...prescription, createdAt: now, updatedAt: now,
      }))).run()
    })
  } catch (error) {
    console.error('Error creating session:', error)
    return { error: error instanceof Error ? error.message : 'No se pudo crear la sesión' }
  }

  const path = sessionsPath(data.locale)
  revalidatePath(path)
  redirect(path)
}

export async function updateSession(_previousState: SessionFormState, formData: FormData): Promise<SessionFormState> {
  const sessionId = formData.get('sessionId')?.toString()
  if (!sessionId) return { error: 'No se pudo identificar la sesión' }

  const parsed = createSessionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Revisá los datos ingresados' }

  const prescriptions = parsePrescriptions(formData)
  if (!prescriptions.success) return { error: prescriptions.error }
  const data = parsed.data

  try {
    const existingSession = db.query.sessions.findFirst({
      where: and(eq(sessions.id, sessionId), eq(sessions.teamId, CURRENT_TEAM_ID), eq(sessions.isDeleted, false)),
    }).sync()
    if (!existingSession) return { error: 'Sesión no encontrada' }

    const referenceError = validatePrescriptionReferences(prescriptions.data)
    if (referenceError) return { error: referenceError }

    if (data.workoutId) {
      const workout = db.query.workouts.findFirst({ where: and(eq(workouts.id, data.workoutId), eq(workouts.isDeleted, false)) }).sync()
      if (!workout) return { error: 'La plantilla de entrenamiento seleccionada no existe' }
    }
    if (data.locationKey) {
      const location = db.query.trainingLocations.findFirst({ where: eq(trainingLocations.key, data.locationKey) }).sync()
      if (!location) return { error: 'La ubicación seleccionada no existe' }
    }

    const structure = data.preliminaryExercises || data.warmup || data.mainBlock || data.cooldown
      ? { preliminaryExercises: data.preliminaryExercises, warmup: data.warmup, mainBlock: data.mainBlock, cooldown: data.cooldown }
      : null
    const now = new Date().toISOString()

    db.transaction((tx) => {
      tx.update(sessions).set({
        workoutId: data.workoutId, date: data.date, title: data.title, type: data.type,
        locationKey: data.locationKey, trackPath: data.trackPath, structure, notes: data.notes, updatedAt: now,
      }).where(eq(sessions.id, sessionId)).run()

      tx.update(groupSessionPrescriptions)
        .set({ isDeleted: true, updatedAt: now })
        .where(eq(groupSessionPrescriptions.sessionId, sessionId))
        .run()

      for (const prescription of prescriptions.data) {
        tx.insert(groupSessionPrescriptions).values({
          id: randomUUID(), sessionId, ...prescription, createdAt: now, updatedAt: now,
        }).onConflictDoUpdate({
          target: [groupSessionPrescriptions.sessionId, groupSessionPrescriptions.groupId],
          set: { ...prescription, isDeleted: false, updatedAt: now },
        }).run()
      }
    })
  } catch (error) {
    console.error('Error updating session:', error)
    return { error: error instanceof Error ? error.message : 'No se pudo actualizar la sesión' }
  }

  const path = sessionsPath(data.locale)
  revalidatePath(path)
  revalidatePath(`${path}/${sessionId}`)
  redirect(`${path}/${sessionId}`)
}

function parsePrescriptions(formData: FormData):
  | { success: true; data: z.infer<typeof prescriptionSchema>[] }
  | { success: false; error: string } {
  const groupIds = [...new Set(formData.getAll('prescriptionGroupId').map((value) => value.toString()))]
  if (groupIds.length === 0) return { success: false, error: 'Asigná la sesión al menos a un grupo' }

  const rows: z.infer<typeof prescriptionSchema>[] = []
  for (const groupId of groupIds) {
    const intensityMethodValue = formData.get(`intensityMethod:${groupId}`)?.toString() || null
    const parsed = prescriptionSchema.safeParse({
      groupId,
      microcycleId: formData.get(`microcycleId:${groupId}`)?.toString() || '',
      distanceKm: formData.get(`distanceKm:${groupId}`)?.toString() || '',
      durationMin: formData.get(`durationMin:${groupId}`)?.toString() || '',
      elevationGain: formData.get(`elevationGain:${groupId}`)?.toString() || '',
      intensityMethod: intensityMethodValue,
      zone: intensityMethodValue === 'hr_zone' ? formData.get(`zone:${groupId}`)?.toString() || null : null,
      pamPercentage: intensityMethodValue === 'pam_percentage' ? formData.get(`pamPercentage:${groupId}`)?.toString() || '' : '',
      notes: formData.get(`prescriptionNotes:${groupId}`)?.toString() || '',
    })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Revisá las prescripciones grupales' }
    }
    rows.push(parsed.data)
  }
  return { success: true, data: rows }
}

function validatePrescriptionReferences(prescriptions: z.infer<typeof prescriptionSchema>[]) {
  for (const prescription of prescriptions) {
    const group = db.query.athleteGroups.findFirst({
      where: and(
        eq(athleteGroups.id, prescription.groupId), eq(athleteGroups.teamId, CURRENT_TEAM_ID),
        eq(athleteGroups.isActive, true), eq(athleteGroups.isDeleted, false),
      ),
    }).sync()
    if (!group) return 'Uno de los grupos seleccionados no existe o está inactivo'

    const microcycle = db.query.microcycles.findFirst({
      where: and(eq(microcycles.id, prescription.microcycleId), eq(microcycles.isDeleted, false)),
      with: { mesocycle: { with: { macrocycle: { with: { groupTrainingPlan: true } } } } },
    }).sync()
    if (!microcycle || microcycle.mesocycle.macrocycle.groupTrainingPlan.groupId !== group.id) {
      return `El microciclo seleccionado no pertenece al grupo ${group.categoryCode}${group.levelCode}`
    }
  }
  return null
}
