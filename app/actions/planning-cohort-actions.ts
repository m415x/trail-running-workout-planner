'use server'

import { randomUUID } from 'node:crypto'
import { and, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { db } from '@/db'
import {
  athleteGroups,
  athleteProfiles,
  groupHistoryRecords,
  groupTrainingPlans,
  planningCohortMemberships,
  planningCohorts,
} from '@/db/schema'
import {
  validatePlanningCohortMembership,
  validatePlanningCohortMembershipClosure,
} from '@/lib/planning-cohorts/membership-policy'
import {
  resolveAthleteGroupOnDate,
  resolveAthletePlanningOnDate,
} from '@/lib/planning-cohorts/planning-resolution'

const CURRENT_TEAM_ID = 'team_1'
const locales = ['es', 'en'] as const

type SupportedLocale = (typeof locales)[number]

const createPlanningCohortSchema = z.object({
  groupId: z.string().trim().min(1, 'Seleccioná un grupo deportivo'),
  name: z.string().trim().min(2, 'Ingresá un nombre de al menos 2 caracteres').max(80, 'El nombre no puede superar los 80 caracteres'),
  purpose: z.string().trim().min(3, 'Describí el objetivo compartido').max(160, 'El objetivo no puede superar los 160 caracteres'),
  description: z.string().trim().max(500, 'La descripción no puede superar los 500 caracteres').optional(),
  locale: z.enum(locales).default('es'),
})

const updatePlanningCohortSchema = createPlanningCohortSchema.omit({ groupId: true }).extend({
  status: z.enum(['active', 'archived']),
})

export interface PlanningCohortFormState {
  error?: string
  values?: {
    groupId?: string
    name?: string
    purpose?: string
    description?: string
  }
}

export interface PlanningCohortMembershipFormState {
  error?: string
  values?: {
    athleteProfileId?: string
    startDate?: string
    endDate?: string
    reason?: string
  }
}

const assignPlanningCohortMembershipSchema = z.object({
  cohortId: z.string().trim().min(1),
  athleteProfileId: z.string().trim().min(1, 'Seleccioná un atleta'),
  startDate: z.iso.date('Ingresá una fecha de inicio válida'),
  reason: z.string().trim().max(300, 'El motivo no puede superar los 300 caracteres').optional(),
  locale: z.enum(locales).default('es'),
})

const closePlanningCohortMembershipSchema = z.object({
  cohortId: z.string().trim().min(1),
  membershipId: z.string().trim().min(1),
  endDate: z.iso.date('Ingresá una fecha de finalización válida'),
  reason: z.string().trim().max(300, 'El motivo no puede superar los 300 caracteres').optional(),
  locale: z.enum(locales).default('es'),
})

function cohortsPath(locale: SupportedLocale) {
  return locale === 'es' ? '/dashboard/cohorts' : `/${locale}/dashboard/cohorts`
}

function formValues(formData: FormData): PlanningCohortFormState['values'] {
  return {
    groupId: formData.get('groupId')?.toString(),
    name: formData.get('name')?.toString(),
    purpose: formData.get('purpose')?.toString(),
    description: formData.get('description')?.toString(),
  }
}

/** Lists active sporting groups eligible to receive a new cohort. */
export async function getActiveGroupsForPlanningCohort() {
  return db.query.athleteGroups.findMany({
    where: and(
      eq(athleteGroups.teamId, CURRENT_TEAM_ID),
      eq(athleteGroups.isActive, true),
      eq(athleteGroups.isDeleted, false),
    ),
    orderBy: (groups, { asc }) => [asc(groups.categoryCode), asc(groups.levelCode)],
  })
}

/** Lists active athletes from the cohort's parent group for manual assignment. */
export async function getAthletesForPlanningCohort(cohortId: string) {
  const cohort = await db.query.planningCohorts.findFirst({
    where: and(
      eq(planningCohorts.id, cohortId),
      eq(planningCohorts.teamId, CURRENT_TEAM_ID),
      eq(planningCohorts.isDeleted, false),
    ),
  })

  if (!cohort) return null

  const athletes = await db.query.athleteProfiles.findMany({
    where: and(
      eq(athleteProfiles.teamId, CURRENT_TEAM_ID),
      eq(athleteProfiles.groupId, cohort.groupId),
      eq(athleteProfiles.isActive, true),
      eq(athleteProfiles.isDeleted, false),
    ),
    with: { user: true },
  })

  athletes.sort((first, second) => (
    `${first.user.lastName} ${first.user.firstName}`.localeCompare(
      `${second.user.lastName} ${second.user.firstName}`,
      'es',
    )
  ))

  return { cohort, athletes }
}

/** Resolves and labels the shared plan applicable to an athlete on one date. */
export async function getAthletePlanningResolutionOnDate(athleteId: string, date: string) {
  const athlete = await db.query.athleteProfiles.findFirst({
    where: and(
      eq(athleteProfiles.id, athleteId),
      eq(athleteProfiles.teamId, CURRENT_TEAM_ID),
      eq(athleteProfiles.isDeleted, false),
    ),
    with: {
      groupHistory: {
        where: eq(groupHistoryRecords.isDeleted, false),
      },
    },
  })

  if (!athlete) return null

  const groupResolution = resolveAthleteGroupOnDate(athlete.groupId, athlete.groupHistory, date)
  const memberships = await db.query.planningCohortMemberships.findMany({
    where: and(
      eq(planningCohortMemberships.athleteProfileId, athlete.id),
      eq(planningCohortMemberships.isDeleted, false),
    ),
    with: {
      planningCohort: {
        with: {
          planningVariant: {
            with: { macrocycles: true },
          },
        },
      },
    },
  })

  const basePlans = groupResolution.groupId === null
    ? []
    : await db.query.groupTrainingPlans.findMany({
      where: and(
        eq(groupTrainingPlans.groupId, groupResolution.groupId),
        eq(groupTrainingPlans.isDeleted, false),
      ),
      with: { group: true, macrocycles: true },
    })

  const visibleBasePlans = basePlans.filter((plan) => (
    plan.group.teamId === CURRENT_TEAM_ID && !plan.group.isDeleted
  ))
  const resolution = resolveAthletePlanningOnDate({
    athleteTeamId: athlete.teamId,
    currentGroupId: athlete.groupId,
    groupChanges: athlete.groupHistory,
    memberships: memberships.map((membership) => ({
      ...membership,
      cohort: membership.planningCohort,
    })),
    basePlans: visibleBasePlans,
    date,
  })

  if (resolution.status !== 'resolved') return { resolution, planTitle: null, cohortName: null }

  const membership = memberships.find((candidate) => candidate.planningCohort.id === resolution.cohortId)
  const resolvedPlan = resolution.source === 'cohort'
    ? membership?.planningCohort.planningVariant
    : visibleBasePlans.find((plan) => plan.id === resolution.planId)

  return {
    resolution,
    planTitle: resolvedPlan?.title ?? null,
    cohortName: membership?.planningCohort.name ?? null,
  }
}

/** Lists visible planning cohorts for the current development team. */
export async function getPlanningCohortsByTeam() {
  return db.query.planningCohorts.findMany({
    where: and(
      eq(planningCohorts.teamId, CURRENT_TEAM_ID),
      eq(planningCohorts.isDeleted, false),
    ),
    with: {
      group: true,
      memberships: {
        where: eq(planningCohortMemberships.isDeleted, false),
      },
      planningVariant: true,
    },
    orderBy: (cohorts, { asc }) => [asc(cohorts.status), asc(cohorts.name)],
  })
}

/** Gets one cohort with its persisted plan and complete membership history. */
export async function getPlanningCohortDetail(cohortId: string) {
  const cohort = await db.query.planningCohorts.findFirst({
    where: and(
      eq(planningCohorts.id, cohortId),
      eq(planningCohorts.teamId, CURRENT_TEAM_ID),
      eq(planningCohorts.isDeleted, false),
    ),
    with: {
      group: true,
      planningVariant: {
        with: {
          sourceGroupTrainingPlan: true,
        },
      },
      memberships: {
        where: eq(planningCohortMemberships.isDeleted, false),
        with: {
          athleteProfile: {
            with: {
              user: true,
            },
          },
        },
      },
    },
  })

  if (!cohort) return null

  if (cohort.planningVariant?.isDeleted) {
    cohort.planningVariant = null
  }

  cohort.memberships.sort((first, second) => {
    const nameComparison = first.athleteProfile.user.lastName.localeCompare(
      second.athleteProfile.user.lastName,
      'es',
    )

    return nameComparison || second.startDate.localeCompare(first.startDate)
  })

  return cohort
}

/** Creates an empty cohort; athlete assignments remain a separate operation. */
export async function createPlanningCohort(
  _previousState: PlanningCohortFormState,
  formData: FormData,
): Promise<PlanningCohortFormState> {
  const parsed = createPlanningCohortSchema.safeParse(Object.fromEntries(formData))
  const values = formValues(formData)

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisá los datos ingresados', values }
  }

  const data = parsed.data

  try {
    const group = db.query.athleteGroups.findFirst({
      where: and(
        eq(athleteGroups.id, data.groupId),
        eq(athleteGroups.teamId, CURRENT_TEAM_ID),
        eq(athleteGroups.isActive, true),
        eq(athleteGroups.isDeleted, false),
      ),
    }).sync()

    if (!group) {
      return { error: 'El grupo seleccionado no está disponible', values }
    }

    const duplicate = db.query.planningCohorts.findFirst({
      where: and(
        eq(planningCohorts.teamId, CURRENT_TEAM_ID),
        eq(planningCohorts.groupId, group.id),
        eq(planningCohorts.name, data.name),
        eq(planningCohorts.isDeleted, false),
      ),
    }).sync()

    if (duplicate) {
      return { error: `Ya existe una cohorte llamada “${data.name}” en ese grupo`, values }
    }

    const now = new Date().toISOString()
    db.insert(planningCohorts).values({
      id: randomUUID(),
      teamId: CURRENT_TEAM_ID,
      groupId: group.id,
      name: data.name,
      purpose: data.purpose,
      description: data.description || null,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }).run()
  } catch (error) {
    console.error('Error creating planning cohort:', error)
    return { error: 'No se pudo crear la cohorte', values }
  }

  const path = cohortsPath(data.locale)
  revalidatePath(path)
  redirect(path)
}

/** Updates cohort metadata and supports one-way archival without moving groups. */
export async function updatePlanningCohort(
  _previousState: PlanningCohortFormState,
  formData: FormData,
): Promise<PlanningCohortFormState> {
  const cohortId = formData.get('cohortId')?.toString()
  const parsed = updatePlanningCohortSchema.safeParse(Object.fromEntries(formData))
  const values = formValues(formData)

  if (!cohortId) return { error: 'No se pudo identificar la cohorte', values }
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisá los datos ingresados', values }
  }

  const data = parsed.data

  try {
    const cohort = db.query.planningCohorts.findFirst({
      where: and(
        eq(planningCohorts.id, cohortId),
        eq(planningCohorts.teamId, CURRENT_TEAM_ID),
        eq(planningCohorts.isDeleted, false),
      ),
    }).sync()

    if (!cohort) return { error: 'Cohorte no encontrada', values }
    if (cohort.status === 'archived') {
      return { error: 'Una cohorte archivada conserva su historial y no puede modificarse', values }
    }

    const duplicate = db.query.planningCohorts.findFirst({
      where: and(
        eq(planningCohorts.teamId, CURRENT_TEAM_ID),
        eq(planningCohorts.groupId, cohort.groupId),
        eq(planningCohorts.name, data.name),
        eq(planningCohorts.isDeleted, false),
        ne(planningCohorts.id, cohort.id),
      ),
    }).sync()

    if (duplicate) {
      return { error: `Ya existe una cohorte llamada “${data.name}” en este grupo`, values }
    }

    db.update(planningCohorts).set({
      name: data.name,
      purpose: data.purpose,
      description: data.description || null,
      status: data.status,
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(planningCohorts.id, cohort.id),
      eq(planningCohorts.teamId, CURRENT_TEAM_ID),
      eq(planningCohorts.isDeleted, false),
    )).run()
  } catch (error) {
    console.error('Error updating planning cohort:', error)
    return { error: 'No se pudo actualizar la cohorte', values }
  }

  const path = cohortsPath(data.locale)
  revalidatePath(path)
  revalidatePath(`${path}/${cohortId}`)
  redirect(`${path}/${cohortId}`)
}

/** Opens a dated membership after validating team, group, lifecycle, and overlap rules. */
export async function assignAthleteToPlanningCohort(
  _previousState: PlanningCohortMembershipFormState,
  formData: FormData,
): Promise<PlanningCohortMembershipFormState> {
  const parsed = assignPlanningCohortMembershipSchema.safeParse(Object.fromEntries(formData))
  const values = {
    athleteProfileId: formData.get('athleteProfileId')?.toString(),
    startDate: formData.get('startDate')?.toString(),
    reason: formData.get('reason')?.toString(),
  }

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisá los datos ingresados', values }
  }

  const data = parsed.data

  try {
    db.transaction((tx) => {
      const cohort = tx.query.planningCohorts.findFirst({
        where: and(
          eq(planningCohorts.id, data.cohortId),
          eq(planningCohorts.teamId, CURRENT_TEAM_ID),
          eq(planningCohorts.isDeleted, false),
        ),
        with: { group: true },
      }).sync()

      if (!cohort) throw new Error('Cohorte no encontrada')

      const athlete = tx.query.athleteProfiles.findFirst({
        where: and(
          eq(athleteProfiles.id, data.athleteProfileId),
          eq(athleteProfiles.teamId, CURRENT_TEAM_ID),
          eq(athleteProfiles.isDeleted, false),
        ),
      }).sync()

      if (!athlete) throw new Error('Atleta no encontrado')

      const existingMemberships = tx.query.planningCohortMemberships.findMany({
        where: and(
          eq(planningCohortMemberships.athleteProfileId, athlete.id),
          eq(planningCohortMemberships.isDeleted, false),
        ),
        with: { planningCohort: true },
      }).sync().map((membership) => ({
        id: membership.id,
        planningCohortId: membership.planningCohortId,
        athleteProfileId: membership.athleteProfileId,
        parentGroupId: membership.planningCohort.groupId,
        startDate: membership.startDate,
        endDate: membership.endDate,
      }))

      const membership = {
        planningCohortId: cohort.id,
        athleteProfileId: athlete.id,
        startDate: data.startDate,
        endDate: null,
        assignedByUserId: null,
        assignmentReason: data.reason || null,
        endedByUserId: null,
        endReason: null,
      }
      const validation = validatePlanningCohortMembership({
        membership,
        cohort,
        athlete,
        parentGroupIsActive: cohort.group.isActive && !cohort.group.isDeleted,
        existingMemberships,
      })

      if (!validation.isValid) {
        throw new Error(validation.errors[0]?.message ?? 'La asignación no es válida')
      }

      const now = new Date().toISOString()
      tx.insert(planningCohortMemberships).values({
        id: randomUUID(),
        ...membership,
        createdAt: now,
        updatedAt: now,
      }).run()
    })
  } catch (error) {
    console.error('Error assigning athlete to planning cohort:', error)
    return { error: error instanceof Error ? error.message : 'No se pudo asignar el atleta', values }
  }

  const path = `${cohortsPath(data.locale)}/${data.cohortId}`
  revalidatePath(path)
  revalidatePath(cohortsPath(data.locale))
  redirect(path)
}

/** Closes an open membership on an inclusive final day without deleting its history. */
export async function closePlanningCohortMembership(
  _previousState: PlanningCohortMembershipFormState,
  formData: FormData,
): Promise<PlanningCohortMembershipFormState> {
  const parsed = closePlanningCohortMembershipSchema.safeParse(Object.fromEntries(formData))
  const values = {
    endDate: formData.get('endDate')?.toString(),
    reason: formData.get('reason')?.toString(),
  }

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisá los datos ingresados', values }
  }

  const data = parsed.data

  try {
    db.transaction((tx) => {
      const cohort = tx.query.planningCohorts.findFirst({
        where: and(
          eq(planningCohorts.id, data.cohortId),
          eq(planningCohorts.teamId, CURRENT_TEAM_ID),
          eq(planningCohorts.isDeleted, false),
        ),
      }).sync()
      if (!cohort) throw new Error('Cohorte no encontrada')

      const membership = tx.query.planningCohortMemberships.findFirst({
        where: and(
          eq(planningCohortMemberships.id, data.membershipId),
          eq(planningCohortMemberships.planningCohortId, cohort.id),
          eq(planningCohortMemberships.isDeleted, false),
        ),
      }).sync()
      if (!membership) throw new Error('Membresía no encontrada')

      const validation = validatePlanningCohortMembershipClosure({ membership, endDate: data.endDate })
      if (!validation.isValid) {
        throw new Error(validation.errors[0]?.message ?? 'La fecha de finalización no es válida')
      }

      tx.update(planningCohortMemberships).set({
        endDate: data.endDate,
        endedByUserId: null,
        endReason: data.reason || null,
        updatedAt: new Date().toISOString(),
      }).where(and(
        eq(planningCohortMemberships.id, membership.id),
        eq(planningCohortMemberships.planningCohortId, cohort.id),
        eq(planningCohortMemberships.isDeleted, false),
      )).run()
    })
  } catch (error) {
    console.error('Error closing planning cohort membership:', error)
    return { error: error instanceof Error ? error.message : 'No se pudo retirar el atleta', values }
  }

  const path = `${cohortsPath(data.locale)}/${data.cohortId}`
  revalidatePath(path)
  revalidatePath(cohortsPath(data.locale))
  redirect(path)
}
