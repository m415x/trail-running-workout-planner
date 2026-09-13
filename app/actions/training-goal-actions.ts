'use server'

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getRaceCourseSelectionContext, linkTrainingGoalToRaceCourse } from '@/lib/race-catalog/catalog-repository'
import { selectRaceCourseForTrainingGoal } from '@/lib/race-catalog/training-goal-selection'
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
  athleteId: z.string().trim().min(1, 'invalid'),
  type: z.enum(goalTypes, 'invalid'),
  title: z.string().trim().min(3, 'invalid').max(120, 'invalid'),
  description: z.string().trim().max(1000, 'invalid').optional(),
  targetDate: z.string().trim().optional(),
  raceName: z.string().trim().max(403, 'invalid').optional(),
  raceDistanceKm: z.string().trim().optional(),
  raceElevationGain: z.string().trim().optional(),
  notes: z.string().trim().max(2000, 'invalid').optional(),
  locale: z.enum(locales).default('es'),
}).superRefine((data, context) => {
  if (data.targetDate && !isValidIsoDate(data.targetDate)) {
    context.addIssue({ code: 'custom', path: ['targetDate'], message: 'invalid' })
  }

  if (data.type !== 'race') return

  if (!data.raceName) {
    context.addIssue({ code: 'custom', path: ['raceName'], message: 'invalid' })
  }

  if (!data.targetDate) {
    context.addIssue({ code: 'custom', path: ['targetDate'], message: 'invalid' })
  }

  const distance = Number(data.raceDistanceKm)
  if (!data.raceDistanceKm || !Number.isFinite(distance) || distance <= 0) {
    context.addIssue({ code: 'custom', path: ['raceDistanceKm'], message: 'invalid' })
  }

  if (data.raceElevationGain) {
    const elevationGain = Number(data.raceElevationGain)
    if (!Number.isFinite(elevationGain) || elevationGain < 0) {
      context.addIssue({ code: 'custom', path: ['raceElevationGain'], message: 'invalid' })
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

export async function getTrainingGoalsForAthlete(athleteId: string) {
  const athlete = db.query.athleteProfiles.findFirst({
    where: and(
      eq(athleteProfiles.id, athleteId),
      eq(athleteProfiles.teamId, CURRENT_TEAM_ID),
      eq(athleteProfiles.isDeleted, false),
    ),
  }).sync()

  if (!athlete) return []

  return db.select()
    .from(trainingGoals)
    .where(and(
      eq(trainingGoals.athleteId, athleteId),
      eq(trainingGoals.isDeleted, false),
    ))
    .all()
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
}

export async function createTrainingGoal(
  _previousState: TrainingGoalFormState,
  formData: FormData,
): Promise<TrainingGoalFormState> {
  let data: ReturnType<typeof trainingGoalFormSchema.parse>
  try {
    const result = db.transaction(() => {
      const raw = Object.fromEntries(formData)
      const raceCourseId = String(formData.get('raceCourseId') ?? '')
      if (raceCourseId && raw.type !== 'race') return { error: 'invalid' }
      if (raceCourseId) {
        const context = getRaceCourseSelectionContext(raceCourseId)
        if (!context) return { error: 'unavailable' }
        if (JSON.stringify([context.event.updatedAt, context.edition.updatedAt, context.course.updatedAt])
          !== formData.get('catalogRevision')) return { error: 'stale' }
        const selection = selectRaceCourseForTrainingGoal(context)
        if (!selection.valid) return { error: 'unavailable' }
        const patch = selection.selection.goalPatch
        Object.assign(raw, {
          title: `${context.event.name} — ${context.course.label}`,
          targetDate: patch.targetDate,
          raceName: patch.raceName,
          raceDistanceKm: String(patch.raceDistanceKm),
          raceElevationGain: patch.raceElevationGain === null ? '' : String(patch.raceElevationGain),
        })
      }
      const parsed = trainingGoalFormSchema.safeParse(raw)
      if (!parsed.success) return {
        error: 'invalid',
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      }
      const input = parsed.data
      const athlete = db.query.athleteProfiles.findFirst({
        where: and(
          eq(athleteProfiles.id, input.athleteId),
          eq(athleteProfiles.teamId, CURRENT_TEAM_ID),
          eq(athleteProfiles.isDeleted, false),
        ),
      }).sync()
      if (!athlete) return { error: 'unavailable' }
      const isRaceGoal = input.type === 'race'
      const now = new Date().toISOString()
      const id = randomUUID()
      db.insert(trainingGoals).values({
        id, athleteId: athlete.id, type: input.type, status: 'draft',
        title: input.title, description: input.description || null,
        targetDate: input.targetDate || null,
        raceName: isRaceGoal ? input.raceName || null : null,
        raceDistanceKm: isRaceGoal ? Number(input.raceDistanceKm) : null,
        raceElevationGain: isRaceGoal && input.raceElevationGain ? Number(input.raceElevationGain) : null,
        notes: input.notes || null, createdAt: now, updatedAt: now,
      }).run()
      if (raceCourseId) linkTrainingGoalToRaceCourse(id, raceCourseId)
      return { data: input }
    })
    if ('error' in result) return { error: result.error, fieldErrors: result.fieldErrors }
    data = result.data
  } catch (error) {
    console.error('Error creating training goal:', error)
    return { error: 'saveFailed' }
  }

  const path = athleteDetailPath(data.locale, data.athleteId)
  revalidatePath(`/${data.locale}/dashboard/athletes/${data.athleteId}`)
  redirect(path)
}
