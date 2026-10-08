'use server'

import { randomUUID } from 'node:crypto'
import { and, desc, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { db } from '@/db'
import { createExternalIdentityLookup } from '@/lib/auth/external-identity-lookup'
import { readEptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptAction } from '@/lib/auth/require-authenticated-action'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'
import { createActiveTeamNextServerContext } from '@/lib/authorization/active-team-next-server'
import { createH4aNextServerAuthorizationBoundary } from '@/lib/authorization/h4a-next-server-authorization'
import { parseSessionPrescriptions, type SessionPrescriptionInput } from '@/lib/sessions/session-prescription-parser'
import { validateSessionMicrocyclePrescriptions } from '@/lib/sessions/session-microcycle-integration'
import { createWorkoutTemplateSnapshot } from '@/lib/workout-templates/workout-template-snapshot'
import { WORKOUT_TYPES, type TrainingIntensity, type WorkoutTemplate } from '@/types'
import {
  athleteGroups,
  groupSessionPrescriptions,
  groupTrainingPlans,
  macrocycles,
  mesocycles,
  microcycles,
  sessions,
  sessionGenerationModificationRecords,
  trainingLocations,
  workouts,
} from '@/db/schema'

const CURRENT_TEAM_ID = 'team_1'
const optionalText = z.string().trim().transform((value) => value || null)

const createSessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(2),
  type: z.enum(WORKOUT_TYPES),
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

export type SessionErrorCode =
  | 'invalidDate'
  | 'titleTooShort'
  | 'workoutTypeRequired'
  | 'invalidForm'
  | 'workoutNotFound'
  | 'locationNotFound'
  | 'createFailed'
  | 'sessionIdMissing'
  | 'sessionNotFound'
  | 'workoutUnavailable'
  | 'updateFailed'
  | 'groupNotFound'
  | 'microcycleGroupMismatch'
  | 'microcycleDateMismatch'
  | 'microcycleDateAmbiguous'
  | import('@/lib/sessions/session-prescription-parser').SessionPrescriptionErrorCode

export interface SessionFormState {
  errorCode?: SessionErrorCode
  errorParams?: { group?: string }
}

function schemaErrorCode(path: PropertyKey[]): SessionErrorCode {
  if (path.includes('date')) return 'invalidDate'
  if (path.includes('title')) return 'titleTooShort'
  if (path.includes('type')) return 'workoutTypeRequired'
  return 'invalidForm'
}

function sessionTemplateOption(row: typeof workouts.$inferSelect) {
  let intensity: TrainingIntensity | null = null
  if (row.intensityMethod === 'hr_zone' && row.zone) {
    intensity = { method: 'hr_zone', zone: row.zone }
  } else if (row.intensityMethod === 'reference_percentage' && row.referencePercentage !== null) {
    intensity = { method: 'reference_percentage', referencePercentage: row.referencePercentage }
  }

  const template: WorkoutTemplate = {
    id: row.id,
    teamId: row.teamId,
    category: row.category,
    tags: row.tags,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isDeleted: row.isDeleted,
    sessionDefaults: {
      title: row.title,
      type: row.type,
      locationKey: row.locationKey,
      trackPath: row.trackPath,
      structure: row.structure,
      notes: row.notes,
    },
    prescriptionDefaults: {
      distanceKm: row.distance,
      durationMin: row.time,
      elevationGain: row.gain,
      intensity,
      notes: row.prescriptionNotes,
    },
  }

  return {
    id: row.id,
    title: row.title,
    type: row.type,
    archivedAt: row.archivedAt,
    snapshot: createWorkoutTemplateSnapshot(template),
  }
}

function sessionsPath(locale: string) {
  return locale === 'es' ? '/dashboard/sessions' : `/${locale}/dashboard/sessions`
}

async function planningReadAccess() {
  const supabase = await createSupabaseServerClient()
  const lookup = createExternalIdentityLookup()
  const access = await requireAuthenticatedEptAction({
    readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
  })
  if (access.status !== 'authenticated') return null
  const activeTeam = await createActiveTeamNextServerContext().resolve(access.userId)
  if (activeTeam.status !== 'resolved') return null
  const authorization = createH4aNextServerAuthorizationBoundary()
  return {
    teamId: activeTeam.teamId,
    async authorizeGroup(groupId: string) {
      const group = await db.query.athleteGroups.findFirst({
        where: and(eq(athleteGroups.id, groupId), eq(athleteGroups.isDeleted, false)),
      })
      if (!group || group.teamId !== activeTeam.teamId) return false
      const decision = await authorization.authorize(access, {
        capability: 'planning.manage',
        resource: { teamId: group.teamId, sportingGroupId: group.id },
        at: new Date().toISOString(),
      })
      return decision.allowed
    },
  }
}

async function authorizeSessionRead(sessionId: string, planningAccess: NonNullable<Awaited<ReturnType<typeof planningReadAccess>>>) {
  const session = await db.query.sessions.findFirst({
    where: and(eq(sessions.id, sessionId), eq(sessions.teamId, planningAccess.teamId), eq(sessions.isDeleted, false)),
  })
  if (!session) return false
  const prescriptions = await db.query.groupSessionPrescriptions.findMany({
    where: and(eq(groupSessionPrescriptions.sessionId, sessionId), eq(groupSessionPrescriptions.isDeleted, false)),
    columns: { groupId: true },
  })
  const groups = [...new Set(prescriptions.map((item) => item.groupId))]
  if (!groups.length) return false
  const decisions = await Promise.all(groups.map((groupId) => planningAccess.authorizeGroup(groupId)))
  return decisions.every(Boolean)
}

export async function getSessionsByTeam(_teamId?: string) {
  const planningAccess = await planningReadAccess()
  if (!planningAccess) return []
  const rows = await db.query.sessions.findMany({
    where: and(eq(sessions.teamId, planningAccess.teamId), eq(sessions.isDeleted, false)),
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
  const decisions = await Promise.all(rows.map((session) => authorizeSessionRead(session.id, planningAccess)))
  return rows.filter((_session, index) => decisions[index])
}

export async function getSessionById(sessionId: string) {
  const planningAccess = await planningReadAccess()
  if (!planningAccess || !await authorizeSessionRead(sessionId, planningAccess)) return undefined
  return db.query.sessions.findFirst({
    where: and(
      eq(sessions.id, sessionId),
      eq(sessions.teamId, planningAccess.teamId),
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

export async function getSessionGenerationExplanationReview(sessionId: string) {
  const planningAccess = await planningReadAccess()
  if (!planningAccess || !await authorizeSessionRead(sessionId, planningAccess)) return []
  const activePrescriptions = db.select({
    id: groupSessionPrescriptions.id,
    generationOwnership: groupSessionPrescriptions.generationOwnership,
    generationKey: groupSessionPrescriptions.generationKey,
  }).from(groupSessionPrescriptions)
    .where(and(
      eq(groupSessionPrescriptions.sessionId, sessionId),
      eq(groupSessionPrescriptions.isDeleted, false),
    ))
    .all()

  if (activePrescriptions.length === 0) return []

  const prescriptionIds = activePrescriptions.map(({ id }) => id)
  const auditRows = db.select({
    prescriptionId: sessionGenerationModificationRecords.prescriptionId,
    generationExplanation: sessionGenerationModificationRecords.generationExplanation,
    createdAt: sessionGenerationModificationRecords.createdAt,
  }).from(sessionGenerationModificationRecords)
    .where(and(
      inArray(sessionGenerationModificationRecords.prescriptionId, prescriptionIds),
      isNotNull(sessionGenerationModificationRecords.generationExplanation),
    ))
    .orderBy(desc(sessionGenerationModificationRecords.createdAt))
    .all()

  const currentByPrescriptionId = new Map(
    activePrescriptions.map((prescription) => [prescription.id, prescription]),
  )
  const seenPrescriptionIds = new Set<string>()
  return auditRows.flatMap((audit) => {
    const prescriptionId = audit.prescriptionId
    if (!prescriptionId || seenPrescriptionIds.has(prescriptionId)) return []

    const current = currentByPrescriptionId.get(prescriptionId)
    if (!current || !audit.generationExplanation) return []

    seenPrescriptionIds.add(prescriptionId)
    return [{
      prescriptionId,
      generationOwnership: current.generationOwnership,
      generationKey: current.generationKey,
      generationExplanation: audit.generationExplanation,
      planningScope: audit.generationExplanation.planningScope,
    }]
  })
}

export async function getSessionFormOptions(includeWorkoutId?: string | null) {
  const planningAccess = await planningReadAccess()
  if (!planningAccess) return { workouts: [], locations: [], groups: [] }
  const workoutOptions = db.query.workouts.findMany({
    where: and(
      eq(workouts.teamId, planningAccess.teamId),
      includeWorkoutId
        ? or(isNull(workouts.archivedAt), eq(workouts.id, includeWorkoutId))
        : isNull(workouts.archivedAt),
      eq(workouts.isDeleted, false),
    ),
    orderBy: (table, { asc }) => [asc(table.title)],
  }).sync()
  const locationOptions = db.select().from(trainingLocations).orderBy(trainingLocations.name).all()
  const groupRows = db.query.athleteGroups.findMany({
    where: and(
      eq(athleteGroups.teamId, planningAccess.teamId),
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

  const allowed = await Promise.all(groupRows.map((group) => planningAccess.authorizeGroup(group.id)))
  const visibleGroupRows = groupRows.filter((_group, index) => allowed[index])
  const groups = visibleGroupRows.map((group) => ({
    id: group.id,
    code: `${group.categoryCode}${group.levelCode}`,
    microcycles: group.trainingPlans.flatMap((plan) => plan.macrocycles.flatMap((macrocycle) =>
      macrocycle.mesocycles.flatMap((mesocycle) => mesocycle.microcycles.map((microcycle) => ({
        id: microcycle.id,
        planTitle: plan.title,
        weekNumber: microcycle.weekNumber,
        startDate: microcycle.startDate,
        endDate: microcycle.endDate,
      }))),
    )),
  }))

  return { workouts: groups.length ? workoutOptions.map(sessionTemplateOption) : [], locations: groups.length ? locationOptions : [], groups }
}

export async function createSession(_previousState: SessionFormState, formData: FormData): Promise<SessionFormState> {
  const parsed = createSessionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errorCode: schemaErrorCode(parsed.error.issues[0]?.path ?? []) }

  const prescriptions = parseSessionPrescriptions(formData)
  if (!prescriptions.success) return { errorCode: prescriptions.errorCode }

  const data = parsed.data

  try {
    if (data.workoutId) {
      const workout = db.query.workouts.findFirst({
        where: and(
          eq(workouts.id, data.workoutId),
          eq(workouts.teamId, CURRENT_TEAM_ID),
          isNull(workouts.archivedAt),
          eq(workouts.isDeleted, false),
        ),
      }).sync()
      if (!workout) return { errorCode: 'workoutNotFound' }
    }

    if (data.locationKey) {
      const location = db.query.trainingLocations.findFirst({ where: eq(trainingLocations.key, data.locationKey) }).sync()
      if (!location) return { errorCode: 'locationNotFound' }
    }

    const structure = data.preliminaryExercises || data.warmup || data.mainBlock || data.cooldown
      ? {
          preliminaryExercises: data.preliminaryExercises,
          warmup: data.warmup,
          mainBlock: data.mainBlock,
          cooldown: data.cooldown,
        }
      : null

    const referenceError = validatePrescriptionReferences(prescriptions.data, data.date)
    if (referenceError) return referenceError

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
    return { errorCode: 'createFailed' }
  }

  const path = sessionsPath(data.locale)
  revalidatePath(path)
  redirect(path)
}

export async function updateSession(_previousState: SessionFormState, formData: FormData): Promise<SessionFormState> {
  const sessionId = formData.get('sessionId')?.toString()
  if (!sessionId) return { errorCode: 'sessionIdMissing' }

  const parsed = createSessionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errorCode: schemaErrorCode(parsed.error.issues[0]?.path ?? []) }

  const prescriptions = parseSessionPrescriptions(formData)
  if (!prescriptions.success) return { errorCode: prescriptions.errorCode }
  const data = parsed.data

  try {
    const existingSession = db.query.sessions.findFirst({
      where: and(eq(sessions.id, sessionId), eq(sessions.teamId, CURRENT_TEAM_ID), eq(sessions.isDeleted, false)),
    }).sync()
    if (!existingSession) return { errorCode: 'sessionNotFound' }

    const referenceError = validatePrescriptionReferences(prescriptions.data, data.date)
    if (referenceError) return referenceError

    if (data.workoutId) {
      const workout = db.query.workouts.findFirst({
        where: and(
          eq(workouts.id, data.workoutId),
          eq(workouts.teamId, CURRENT_TEAM_ID),
          eq(workouts.isDeleted, false),
        ),
      }).sync()
      if (!workout || (workout.archivedAt && existingSession.workoutId !== workout.id)) {
        return { errorCode: 'workoutUnavailable' }
      }
    }
    if (data.locationKey) {
      const location = db.query.trainingLocations.findFirst({ where: eq(trainingLocations.key, data.locationKey) }).sync()
      if (!location) return { errorCode: 'locationNotFound' }
    }

    const structure = data.preliminaryExercises || data.warmup || data.mainBlock || data.cooldown
      ? { preliminaryExercises: data.preliminaryExercises, warmup: data.warmup, mainBlock: data.mainBlock, cooldown: data.cooldown }
      : null
    const now = new Date().toISOString()
    const existingPrescriptions = db.select().from(groupSessionPrescriptions)
      .where(eq(groupSessionPrescriptions.sessionId, sessionId)).all()
    const prescriptionOwnership = new Map(existingPrescriptions.map((prescription) => [
      prescription.microcycleId,
      prescription.generationOwnership === 'generated'
        ? 'generated_modified' as const
        : prescription.generationOwnership,
    ]))
    const selectedMicrocycleIds = [...new Set(prescriptions.data.map(({ microcycleId }) => microcycleId))]
    const auditPlans = selectedMicrocycleIds.length === 0 ? [] : db.select({
      microcycleId: microcycles.id,
      planId: groupTrainingPlans.id,
    }).from(microcycles)
      .innerJoin(mesocycles, eq(microcycles.mesocycleId, mesocycles.id))
      .innerJoin(macrocycles, eq(mesocycles.macrocycleId, macrocycles.id))
      .innerJoin(groupTrainingPlans, eq(macrocycles.groupTrainingPlanId, groupTrainingPlans.id))
      .where(inArray(microcycles.id, selectedMicrocycleIds)).all()
    const planIdByMicrocycle = new Map(auditPlans.map(({ microcycleId, planId }) => [microcycleId, planId]))

    db.transaction((tx) => {
      tx.update(sessions).set({
        workoutId: data.workoutId, date: data.date, title: data.title, type: data.type,
        locationKey: data.locationKey, trackPath: data.trackPath, structure, notes: data.notes,
        generationOwnership: existingSession.generationOwnership === 'generated'
          ? 'generated_modified'
          : existingSession.generationOwnership,
        updatedAt: now,
      }).where(eq(sessions.id, sessionId)).run()

      for (const planId of new Set(auditPlans.map(({ planId }) => planId))) {
        tx.insert(sessionGenerationModificationRecords).values({
          id: randomUUID(), groupTrainingPlanId: planId, sessionId,
          action: 'manual_modified',
          ownership: existingSession.generationOwnership === 'generated'
            ? 'generated_modified'
            : existingSession.generationOwnership,
          generationKey: existingSession.sharedEventKey,
          previousValue: JSON.stringify(existingSession),
          newValue: JSON.stringify({
            workoutId: data.workoutId, date: data.date, title: data.title, type: data.type,
            locationKey: data.locationKey, trackPath: data.trackPath, structure, notes: data.notes,
          }),
          changedByUserId: null, createdAt: now, updatedAt: now,
        }).run()
      }

      tx.update(groupSessionPrescriptions)
        .set({ isDeleted: true, updatedAt: now })
        .where(eq(groupSessionPrescriptions.sessionId, sessionId))
        .run()

      for (const prescription of prescriptions.data) {
        const previousPrescription = existingPrescriptions.find(
          (existing) => existing.microcycleId === prescription.microcycleId,
        )
        tx.insert(groupSessionPrescriptions).values({
          id: randomUUID(), sessionId, ...prescription,
          generationOwnership: prescriptionOwnership.get(prescription.microcycleId) ?? 'manual',
          createdAt: now, updatedAt: now,
        }).onConflictDoUpdate({
          target: [groupSessionPrescriptions.sessionId, groupSessionPrescriptions.microcycleId],
          set: {
            ...prescription,
            generationOwnership: prescriptionOwnership.get(prescription.microcycleId) ?? 'manual',
            isDeleted: false,
            updatedAt: now,
          },
        }).run()
        const planId = planIdByMicrocycle.get(prescription.microcycleId)
        if (planId && previousPrescription) {
          tx.insert(sessionGenerationModificationRecords).values({
            id: randomUUID(), groupTrainingPlanId: planId, sessionId,
            prescriptionId: previousPrescription.id, action: 'manual_modified',
            ownership: prescriptionOwnership.get(prescription.microcycleId) ?? 'manual',
            generationKey: previousPrescription.generationKey,
            previousValue: JSON.stringify(previousPrescription),
            newValue: JSON.stringify(prescription), changedByUserId: null,
            createdAt: now, updatedAt: now,
          }).run()
        }
      }
    })
  } catch (error) {
    console.error('Error updating session:', error)
    return { errorCode: 'updateFailed' }
  }

  const path = sessionsPath(data.locale)
  revalidatePath(path)
  revalidatePath(`${path}/${sessionId}`)
  redirect(`${path}/${sessionId}`)
}

function validatePrescriptionReferences(prescriptions: SessionPrescriptionInput[], sessionDate: string) {
  const candidatesByGroup: Record<string, Array<{ id: string; startDate: string; endDate: string }>> = {}
  const groupCodes = new Map<string, string>()
  for (const prescription of prescriptions) {
    const group = db.query.athleteGroups.findFirst({
      where: and(
        eq(athleteGroups.id, prescription.groupId), eq(athleteGroups.teamId, CURRENT_TEAM_ID),
        eq(athleteGroups.isActive, true), eq(athleteGroups.isDeleted, false),
      ),
    }).sync()
    if (!group) return { errorCode: 'groupNotFound' as const }
    groupCodes.set(group.id, `${group.categoryCode}${group.levelCode}`)

    const microcycle = db.query.microcycles.findFirst({
      where: and(eq(microcycles.id, prescription.microcycleId), eq(microcycles.isDeleted, false)),
      with: { mesocycle: { with: { macrocycle: { with: { groupTrainingPlan: true } } } } },
    }).sync()
    if (!microcycle || microcycle.mesocycle.macrocycle.groupTrainingPlan.groupId !== group.id
      || microcycle.mesocycle.macrocycle.groupTrainingPlan.isDeleted
      || microcycle.mesocycle.macrocycle.isDeleted || microcycle.mesocycle.isDeleted) {
      return { errorCode: 'microcycleGroupMismatch' as const, errorParams: { group: groupCodes.get(group.id) } }
    }

    candidatesByGroup[group.id] = db.select({
      id: microcycles.id,
      startDate: microcycles.startDate,
      endDate: microcycles.endDate,
    }).from(microcycles)
      .innerJoin(mesocycles, eq(microcycles.mesocycleId, mesocycles.id))
      .innerJoin(macrocycles, eq(mesocycles.macrocycleId, macrocycles.id))
      .innerJoin(groupTrainingPlans, eq(macrocycles.groupTrainingPlanId, groupTrainingPlans.id))
      .where(and(
        eq(groupTrainingPlans.groupId, group.id),
        eq(groupTrainingPlans.isDeleted, false),
        eq(macrocycles.isDeleted, false),
        eq(mesocycles.isDeleted, false),
        eq(microcycles.isDeleted, false),
      )).all()
  }

  const dateError = validateSessionMicrocyclePrescriptions(sessionDate, prescriptions, candidatesByGroup)
  if (dateError) {
    return { ...dateError, errorParams: { group: groupCodes.get(dateError.errorParams.group) ?? dateError.errorParams.group } }
  }
  return null
}
