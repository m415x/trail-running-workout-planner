'use server'

import { randomUUID } from 'node:crypto'
import { and, eq, inArray, isNull, ne } from 'drizzle-orm'
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
import { competitionEntries } from '@/db/competition-entry-schema'
import {
  athleteGroups,
  athleteProfiles,
  groupHistoryRecords,
  groupTrainingPlans,
  planningCohortMemberships,
  planningCohorts,
} from '@/db/schema'
import { projectAthleteAdministrativeRead } from '@/lib/athletes/administrative-read-model'
import { sortPlanningCohortMembers } from '@/lib/planning-cohorts/member-order'
import {
  validatePlanningCohortMembership,
  validatePlanningCohortMembershipClosure,
} from '@/lib/planning-cohorts/membership-policy'
import {
  resolveAthleteGroupOnDate,
  resolveAthletePlanningOnDate,
} from '@/lib/planning-cohorts/planning-resolution'
import {
  persistPlanningCohortVariantSynchronously,
  PlanningVariantPersistenceError,
} from '@/lib/planning-cohorts/variant-persistence'

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

export interface PlanningCohortVariantDerivationFormState {
  error?: string
  values?: {
    sourcePlanId?: string
    title?: string
    selectedCompetitionEntryIds?: string[]
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

async function requirePlanningContext() {
  const supabase = await createSupabaseServerClient()
  const lookup = createExternalIdentityLookup()
  const access = await requireAuthenticatedEptAction({
    readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
  })
  if (access.status !== 'authenticated') return null
  const activeTeam = await createActiveTeamNextServerContext().resolve(access.userId)
  if (activeTeam.status !== 'resolved') return null
  const authorization = createH4aNextServerAuthorizationBoundary()
  const authorizeGroup = async (groupId: string, teamId: string) => {
    if (teamId !== activeTeam.teamId) return false
    const decision = await authorization.authorize(access, {
      capability: 'planning.manage',
      resource: { teamId, sportingGroupId: groupId },
      at: new Date().toISOString(),
    })
    return decision.allowed
  }
  return { access, teamId: activeTeam.teamId, authorizeGroup }
}

/** Lists active sporting groups eligible to receive a new cohort. */
export async function getActiveGroupsForPlanningCohort() {
  const planningContext = await requirePlanningContext()
  if (!planningContext) return []
  const groups = await db.query.athleteGroups.findMany({
    where: and(
      eq(athleteGroups.teamId, planningContext.teamId),
      eq(athleteGroups.isActive, true),
      eq(athleteGroups.isDeleted, false),
    ),
    orderBy: (groups, { asc }) => [asc(groups.categoryCode), asc(groups.levelCode)],
  })
  const visible = await Promise.all(groups.map((group) =>
    planningContext.authorizeGroup(group.id, group.teamId),
  ))
  return groups.filter((_group, index) => visible[index])
}

/** Lists active athletes from the cohort's parent group for manual assignment. */
export async function getAthletesForPlanningCohort(cohortId: string) {
  const planningContext = await requirePlanningContext()
  if (!planningContext) return null
  const cohort = await db.query.planningCohorts.findFirst({
    where: and(
      eq(planningCohorts.id, cohortId),
      eq(planningCohorts.teamId, planningContext.teamId),
      eq(planningCohorts.isDeleted, false),
    ),
  })

  if (!cohort || !await planningContext.authorizeGroup(cohort.groupId, cohort.teamId)) return null

  const athletes = await db.query.athleteProfiles.findMany({
    where: and(
      eq(athleteProfiles.teamId, planningContext.teamId),
      eq(athleteProfiles.groupId, cohort.groupId),
      eq(athleteProfiles.isActive, true),
      eq(athleteProfiles.isDeleted, false),
    ),
    with: { user: true },
  })

  athletes.sort((first, second) => {
    const firstName = projectAthleteAdministrativeRead(first).name
    const secondName = projectAthleteAdministrativeRead(second).name
    if (firstName === null && secondName !== null) return 1
    if (firstName !== null && secondName === null) return -1
    if (firstName && secondName) {
      const byLastName = firstName.lastName.localeCompare(secondName.lastName, 'es')
      if (byLastName !== 0) return byLastName
      const byFirstName = firstName.firstName.localeCompare(secondName.firstName, 'es')
      if (byFirstName !== 0) return byFirstName
    }
    return first.id.localeCompare(second.id)
  })

  return { cohort, athletes }
}

/** Resolves and labels the shared plan applicable to an athlete on one date. */
export async function getAthletePlanningResolutionOnDate(athleteId: string, date: string) {
  const planningContext = await requirePlanningContext()
  if (!planningContext) return null
  const athlete = await db.query.athleteProfiles.findFirst({
    where: and(
      eq(athleteProfiles.id, athleteId),
      eq(athleteProfiles.teamId, planningContext.teamId),
      eq(athleteProfiles.isDeleted, false),
    ),
    with: {
      groupHistory: {
        where: eq(groupHistoryRecords.isDeleted, false),
      },
    },
  })

  if (!athlete) return null
  const effectiveGroup = resolveAthleteGroupOnDate(athlete.groupId, athlete.groupHistory, date)
  if (!effectiveGroup.groupId || !await planningContext.authorizeGroup(effectiveGroup.groupId, athlete.teamId)) return null

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
    plan.group.teamId === planningContext.teamId && !plan.group.isDeleted
  ))
  const permittedMemberships = (await Promise.all(memberships.map(async (membership) =>
    membership.planningCohort.teamId === planningContext.teamId
    && await planningContext.authorizeGroup(membership.planningCohort.groupId, membership.planningCohort.teamId)
  )))
  if (permittedMemberships.some((permitted) => !permitted)) return null
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
  const planningContext = await requirePlanningContext()
  if (!planningContext) return []
  const cohorts = await db.query.planningCohorts.findMany({
    where: and(
      eq(planningCohorts.teamId, planningContext.teamId),
      eq(planningCohorts.isDeleted, false),
    ),
    with: {
      group: true,
      memberships: {
        where: and(
          eq(planningCohortMemberships.isDeleted, false),
          inArray(
            planningCohortMemberships.athleteProfileId,
            db.select({ id: athleteProfiles.id })
              .from(athleteProfiles)
              .where(eq(athleteProfiles.teamId, planningContext.teamId)),
          ),
        ),
      },
      planningVariant: true,
    },
    orderBy: (cohorts, { asc }) => [asc(cohorts.status), asc(cohorts.name)],
  })
  const visible = await Promise.all(cohorts.map((cohort) =>
    planningContext.authorizeGroup(cohort.groupId, cohort.teamId),
  ))
  return cohorts.filter((_cohort, index) => visible[index])
}

/** Gets one cohort with its persisted plan and complete membership history. */
export async function getPlanningCohortDetail(cohortId: string) {
  const planningContext = await requirePlanningContext()
  if (!planningContext) return null
  const cohort = await db.query.planningCohorts.findFirst({
    where: and(
      eq(planningCohorts.id, cohortId),
      eq(planningCohorts.teamId, planningContext.teamId),
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

  if (!cohort || !await planningContext.authorizeGroup(cohort.groupId, cohort.teamId)) return null

  if (cohort.planningVariant?.isDeleted) {
    cohort.planningVariant = null
  }

  sortPlanningCohortMembers(cohort.memberships)

  return cohort
}

/** Loads the valid base plans and their competition snapshots for one active planning subgroup. */
export async function getPlanningCohortVariantDerivationContext(cohortId: string) {
  const planningContext = await requirePlanningContext()
  if (!planningContext) return null
  const cohort = await db.query.planningCohorts.findFirst({
    where: and(
      eq(planningCohorts.id, cohortId),
      eq(planningCohorts.teamId, planningContext.teamId),
      eq(planningCohorts.isDeleted, false),
    ),
    with: {
      group: true,
      planningVariant: true,
    },
  })

  if (!cohort || cohort.group.isDeleted
    || !await planningContext.authorizeGroup(cohort.groupId, cohort.teamId)) return null

  const basePlans = await db.query.groupTrainingPlans.findMany({
    where: and(
      eq(groupTrainingPlans.groupId, cohort.groupId),
      isNull(groupTrainingPlans.planningCohortId),
      isNull(groupTrainingPlans.sourceGroupTrainingPlanId),
      eq(groupTrainingPlans.isDeleted, false),
    ),
    with: { group: true },
  })

  const visibleBasePlans = basePlans.filter((plan) => (
    plan.group.teamId === planningContext.teamId && !plan.group.isDeleted
  ))

  const competitions = visibleBasePlans.length === 0
    ? []
    : db.select().from(competitionEntries).where(eq(competitionEntries.isDeleted, false)).all()
      .filter((entry) => visibleBasePlans.some((plan) => plan.id === entry.groupTrainingPlanId))

  return {
    cohort,
    basePlans: visibleBasePlans.map((plan) => ({
      ...plan,
      competitionEntries: competitions.filter((entry) => entry.groupTrainingPlanId === plan.id),
    })),
  }
}

/** Creates one draft planning variant from the reviewed base-plan snapshot. */
export async function derivePlanningCohortVariantAction(
  _previousState: PlanningCohortVariantDerivationFormState,
  formData: FormData,
): Promise<PlanningCohortVariantDerivationFormState> {
  const cohortId = String(formData.get('cohortId') ?? '')
  const sourcePlanId = String(formData.get('sourcePlanId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const locale: SupportedLocale = formData.get('locale') === 'en' ? 'en' : 'es'
  const selectedCompetitionEntryIds = formData.getAll('selectedCompetitionEntryIds').map(String)
  const values = { sourcePlanId, title, selectedCompetitionEntryIds }

  if (!cohortId || !sourcePlanId || title.length < 2) {
    return { error: 'Revisá el plan base y el título de la variante', values }
  }

  try {
    const planningContext = await requirePlanningContext()
    if (!planningContext) return { error: 'No autorizado', values }
    const context = await getPlanningCohortVariantDerivationContext(cohortId)

    if (!context || context.cohort.status !== 'active') {
      return { error: 'El subgrupo de planificación ya no está disponible para derivar una variante', values }
    }

    if (context.cohort.planningVariant) {
      return { error: 'Este subgrupo de planificación ya tiene una variante', values }
    }

    const reviewedBasePlan = context.basePlans.find((plan) => plan.id === sourcePlanId)
    if (!reviewedBasePlan) {
      return { error: 'El plan base seleccionado ya no está disponible para este subgrupo', values }
    }

    const cohortAuthorized = await planningContext.authorizeGroup(
      context.cohort.groupId,
      context.cohort.teamId,
    )
    const sourceAuthorized = await planningContext.authorizeGroup(
      reviewedBasePlan.groupId,
      reviewedBasePlan.group.teamId,
    )
    if (!cohortAuthorized || !sourceAuthorized) {
      return { error: 'No autorizado', values }
    }

    const reviewedCompetitionIds = new Set(
      reviewedBasePlan.competitionEntries.map((competition) => competition.id),
    )
    const competitionsBelongToBasePlan = selectedCompetitionEntryIds.every(
      (competitionEntryId) => reviewedCompetitionIds.has(competitionEntryId),
    )

    if (!competitionsBelongToBasePlan) {
      return { error: 'Una o más competencias seleccionadas ya no pertenecen al plan base revisado', values }
    }

    persistPlanningCohortVariantSynchronously({
      db,
      teamId: planningContext.teamId,
      cohortId,
      sourcePlanId,
      title,
      selectedCompetitionEntryIds,
      createId: randomUUID,
      now: () => new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error deriving planning cohort variant:', error)
    return {
      error: error instanceof PlanningVariantPersistenceError
        ? error.message
        : 'No se pudo crear la variante',
      values,
    }
  }

  const path = `${cohortsPath(locale)}/${cohortId}`
  revalidatePath(path)
  revalidatePath(cohortsPath(locale))
  redirect(path)
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
    const planningContext = await requirePlanningContext()
    if (!planningContext) return { error: 'No autorizado', values }
    const group = db.query.athleteGroups.findFirst({
      where: and(
        eq(athleteGroups.id, data.groupId),
        eq(athleteGroups.teamId, planningContext.teamId),
        eq(athleteGroups.isActive, true),
        eq(athleteGroups.isDeleted, false),
      ),
    }).sync()

    if (!group) {
      return { error: 'El grupo seleccionado no está disponible', values }
    }

    const authorized = await planningContext.authorizeGroup(group.id, group.teamId)
    if (!authorized) return { error: 'No autorizado', values }

    const duplicate = db.query.planningCohorts.findFirst({
      where: and(
        eq(planningCohorts.teamId, planningContext.teamId),
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
      teamId: planningContext.teamId,
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
    const planningContext = await requirePlanningContext()
    if (!planningContext) return { error: 'No autorizado', values }
    const cohort = db.query.planningCohorts.findFirst({
      where: and(
        eq(planningCohorts.id, cohortId),
        eq(planningCohorts.teamId, planningContext.teamId),
        eq(planningCohorts.isDeleted, false),
      ),
    }).sync()

    if (!cohort) return { error: 'Cohorte no encontrada', values }
    const authorized = await planningContext.authorizeGroup(cohort.groupId, cohort.teamId)
    if (!authorized) return { error: 'No autorizado', values }
    if (cohort.status === 'archived') {
      return { error: 'Una cohorte archivada conserva su historial y no puede modificarse', values }
    }

    const duplicate = db.query.planningCohorts.findFirst({
      where: and(
        eq(planningCohorts.teamId, planningContext.teamId),
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
      eq(planningCohorts.teamId, planningContext.teamId),
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
    const planningContext = await requirePlanningContext()
    if (!planningContext) return { error: 'No autorizado', values }

    const scopedCohort = await db.query.planningCohorts.findFirst({
      where: and(
        eq(planningCohorts.id, data.cohortId),
        eq(planningCohorts.teamId, planningContext.teamId),
        eq(planningCohorts.isDeleted, false),
      ),
    })
    if (!scopedCohort) return { error: 'Cohorte no encontrada', values }
    const authorized = await planningContext.authorizeGroup(scopedCohort.groupId, scopedCohort.teamId)
    if (!authorized) return { error: 'No autorizado', values }

    db.transaction((tx) => {
      const cohort = tx.query.planningCohorts.findFirst({
        where: and(
          eq(planningCohorts.id, data.cohortId),
          eq(planningCohorts.teamId, planningContext.teamId),
          eq(planningCohorts.isDeleted, false),
        ),
        with: { group: true },
      }).sync()

      if (!cohort) throw new Error('Cohorte no encontrada')

      const athlete = tx.query.athleteProfiles.findFirst({
        where: and(
          eq(athleteProfiles.id, data.athleteProfileId),
          eq(athleteProfiles.teamId, planningContext.teamId),
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
        assignedByUserId: planningContext.access.userId,
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
    const planningContext = await requirePlanningContext()
    if (!planningContext) return { error: 'No autorizado', values }

    const scopedCohort = await db.query.planningCohorts.findFirst({
      where: and(
        eq(planningCohorts.id, data.cohortId),
        eq(planningCohorts.teamId, planningContext.teamId),
        eq(planningCohorts.isDeleted, false),
      ),
    })
    if (!scopedCohort) return { error: 'Cohorte no encontrada', values }
    const authorized = await planningContext.authorizeGroup(scopedCohort.groupId, scopedCohort.teamId)
    if (!authorized) return { error: 'No autorizado', values }

    db.transaction((tx) => {
      const cohort = tx.query.planningCohorts.findFirst({
        where: and(
          eq(planningCohorts.id, data.cohortId),
          eq(planningCohorts.teamId, planningContext.teamId),
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
        endedByUserId: planningContext.access.userId,
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
