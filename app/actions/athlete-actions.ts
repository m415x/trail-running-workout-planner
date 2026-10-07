'use server'

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { db } from '@/db'
import {
  athleteGroups,
  athleteProfiles,
  planningCohortMemberships,
} from '@/db/schema'
import { createAthleteGroupAssignmentAction } from '@/lib/athletes/group-assignment-action'
import { setAthleteProfileActiveState } from '@/lib/athletes/athlete-profile-lifecycle'
import { createAthleteAdministration } from '@/lib/athletes/create-athlete-administration'
import { projectAthleteAdministrativeRead } from '@/lib/athletes/administrative-read-model'
import { updateAthleteAdministration } from '@/lib/athletes/update-athlete-administration'

export type { AthleteGroupFormState } from '@/lib/athletes/group-assignment-action'
import { classifyPlanningCohortMembership } from '@/lib/planning-cohorts/membership-view'
import { createMembershipServerActionRuntime } from '@/lib/memberships/billing-server-action-runtime'
import { createExternalIdentityLookup } from '@/lib/auth/external-identity-lookup'
import { readEptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptAction } from '@/lib/auth/require-authenticated-action'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'
import { createH4aNextServerAuthorizationBoundary } from '@/lib/authorization/h4a-next-server-authorization'

export interface AthleteFormState {
  error?: string
  values?: {
    firstName?: string
    lastName?: string
    email?: string
    dni?: string
    nickName?: string
    birthday?: string
    phone?: string
    emergencyContact?: string
    emergencyPhone?: string
  }
}

const CURRENT_TEAM_ID = 'team_1'

const athleteFormSchema = z.object({
  firstName: z.string().trim().min(2, 'Ingresá el nombre del atleta'),
  lastName: z.string().trim().min(2, 'Ingresá el apellido del atleta'),
  email: z.email('Ingresá un email válido').transform((value) => value.toLowerCase()),
  dni: z.string().trim().min(6, 'Ingresá un DNI válido'),
  nickName: z.string().trim().optional(),
  birthday: z.string().trim().optional().refine(
    (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= getCurrentDateInArgentina(),
    'La fecha de nacimiento no puede ser futura',
  ),
  phone: z.string().trim().optional(),
  emergencyContact: z.string().trim().optional(),
  emergencyPhone: z.string().trim().optional(),
  locale: z.string().trim().default('es'),
})

const athleteEditFormSchema = athleteFormSchema.extend({
  email: z.union([
    z.literal(''),
    z.email('Ingresá un email válido'),
  ]).transform((value) => value.toLowerCase()),
  nameWriteIntent: z.enum(['preserve', 'replace']),
})


function nullable(value?: string) {
  return value || null
}

function athleteFormValues(formData: FormData): AthleteFormState['values'] {
  const value = (name: string) => {
    const entry = formData.get(name)
    return typeof entry === 'string' ? entry : undefined
  }
  return {
    firstName: value('firstName'),
    lastName: value('lastName'),
    email: value('email'),
    dni: value('dni'),
    nickName: value('nickName'),
    birthday: value('birthday'),
    phone: value('phone'),
    emergencyContact: value('emergencyContact'),
    emergencyPhone: value('emergencyPhone'),
  }
}

function athletesPath(locale: string) {
  return locale === 'es' ? '/dashboard/athletes' : `/${locale}/dashboard/athletes`
}

function getCurrentDateInArgentina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export async function getAthletesByTeam() {
  try {
    const supabase = await createSupabaseServerClient()
    const lookup = createExternalIdentityLookup()
    const access = await requireAuthenticatedEptAction({
      readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
    })

    if (access.status !== 'authenticated') {
      return {
        success: false as const,
        data: [],
        error: 'No autorizado',
      }
    }

    const authorization = createH4aNextServerAuthorizationBoundary()
    const authorizationResult = await authorization.authorize(access, {
      capability: 'athlete.admin.manage',
      resource: { teamId: '' },
      at: new Date().toISOString(),
      requiredScope: 'team',
    })

    if (!authorizationResult.allowed || !('teamId' in authorizationResult)) {
      return {
        success: false as const,
        data: [],
        error: 'No autorizado',
      }
    }

    const athletes = await db.query.athleteProfiles.findMany({
      where: and(
        eq(athleteProfiles.teamId, authorizationResult.teamId),
        eq(athleteProfiles.isDeleted, false),
      ),
      with: {
        user: true,
        group: true,
        planningCohortMemberships: {
          where: eq(planningCohortMemberships.isDeleted, false),
          with: { planningCohort: true },
        },
      },
    })

    athletes.sort((first, second) => {
      const firstAdministrative = projectAthleteAdministrativeRead(first)
      const secondAdministrative = projectAthleteAdministrativeRead(second)
      const firstName = firstAdministrative.name
        ? `${firstAdministrative.name.lastName} ${firstAdministrative.name.firstName}`
        : null
      const secondName = secondAdministrative.name
        ? `${secondAdministrative.name.lastName} ${secondAdministrative.name.firstName}`
        : null

      if (firstName === null && secondName !== null) return 1
      if (firstName !== null && secondName === null) return -1
      if (firstName !== null && secondName !== null) {
        const byName = firstName.localeCompare(secondName, 'es')
        if (byName !== 0) return byName
      }

      return first.id.localeCompare(second.id)
    })

    const today = getCurrentDateInArgentina()
    const listItems = athletes.map(({ planningCohortMemberships: memberships, ...athlete }) => {
      const currentMemberships = memberships.filter((membership) => (
        !membership.planningCohort.isDeleted
        && classifyPlanningCohortMembership(membership, today) === 'current'
      ))
      const currentMembership = currentMemberships.length === 1 ? currentMemberships[0] : null

      return {
        ...athlete,
        administrative: projectAthleteAdministrativeRead(athlete),
        currentPlanningCohort: currentMembership
          ? { id: currentMembership.planningCohort.id, name: currentMembership.planningCohort.name }
          : null,
        hasPlanningCohortConflict: currentMemberships.length > 1,
      }
    })

    return {
      success: true as const,
      data: listItems,
    }
  } catch (error) {
    console.error('Error fetching athletes:', error)

    return {
      success: false as const,
      data: [],
      error: 'No se pudo cargar el listado de atletas',
    }
  }
}

export async function getAthleteById(athleteId: string) {
  const athlete = await db.query.athleteProfiles.findFirst({
    where: and(
      eq(athleteProfiles.id, athleteId),
      eq(athleteProfiles.isDeleted, false),
    ),
    with: {
      user: true,
      group: true,
    },
  })

  if (!athlete) return undefined

  const supabase = await createSupabaseServerClient()
  const lookup = createExternalIdentityLookup()
  const access = await requireAuthenticatedEptAction({
    readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
  })

  if (access.status !== 'authenticated') {
    return undefined
  }

  const authorization = createH4aNextServerAuthorizationBoundary()
  const authorizationResult = await authorization.authorize(access, {
    capability: 'athlete.admin.manage',
    resource: { teamId: athlete.teamId },
    at: new Date().toISOString(),
    requiredScope: 'team',
  })

  if (!authorizationResult.allowed) {
    return undefined
  }

  return athlete
}

export async function getActiveAthleteGroups() {
  return db.query.athleteGroups.findMany({
    where: and(
      eq(athleteGroups.teamId, CURRENT_TEAM_ID),
      eq(athleteGroups.isActive, true),
      eq(athleteGroups.isDeleted, false),
    ),
    orderBy: (groups, { asc }) => [asc(groups.categoryCode), asc(groups.levelCode)],
  })
}

export async function createAthlete(_previousState: AthleteFormState, formData: FormData): Promise<AthleteFormState> {
  const parsed = athleteFormSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisá los datos ingresados' }
  }

  const data = parsed.data

  try {
    const now = new Date().toISOString()
    const athleteId = randomUUID()

    createAthleteAdministration(db, {
      athleteId,
      teamId: CURRENT_TEAM_ID,
      firstName: data.firstName,
      lastName: data.lastName,
      contactEmail: data.email,
      dni: data.dni,
      nickName: nullable(data.nickName),
      birthday: nullable(data.birthday),
      phone: nullable(data.phone),
      emergencyContact: nullable(data.emergencyContact),
      emergencyPhone: nullable(data.emergencyPhone),
      createdAt: now,
    }, (tx) => {
      createMembershipServerActionRuntime({
        db: tx,
        createId: randomUUID,
      }).initializeNewAthleteBillingInTransaction({
        teamId: CURRENT_TEAM_ID,
        athleteId,
        effectiveFrom: getCurrentDateInArgentina(),
      })
    })
  } catch (error) {
    console.error('Error creating athlete:', error)
    return { error: error instanceof Error ? error.message : 'No se pudo crear el atleta' }
  }

  const path = athletesPath(data.locale)
  revalidatePath(path)
  redirect(path)
}

export async function updateAthlete(_previousState: AthleteFormState, formData: FormData): Promise<AthleteFormState> {
  const athleteId = formData.get('athleteId')?.toString()
  const parsed = athleteEditFormSchema.safeParse(Object.fromEntries(formData))

  const values = athleteFormValues(formData)

  if (!athleteId) {
    return { error: 'No se pudo identificar al atleta', values }
  }

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisá los datos ingresados', values }
  }

  const data = parsed.data

  try {
    updateAthleteAdministration(db, {
      teamId: CURRENT_TEAM_ID,
      athleteId,
      firstName: data.firstName,
      lastName: data.lastName,
      contactEmail: nullable(data.email),
      dni: data.dni,
      nickName: nullable(data.nickName),
      birthday: nullable(data.birthday),
      phone: nullable(data.phone),
      emergencyContact: nullable(data.emergencyContact),
      emergencyPhone: nullable(data.emergencyPhone),
      nameWriteIntent: data.nameWriteIntent,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error updating athlete:', error)
    return {
      error: error instanceof Error ? error.message : 'No se pudo actualizar el atleta',
      values,
    }
  }

  const path = athletesPath(data.locale)
  revalidatePath(path)
  redirect(path)
}

export async function setAthleteActiveState(athleteId: string, isActive: boolean, locale: string = 'es') {
  try {
    setAthleteProfileActiveState(db, {
      teamId: CURRENT_TEAM_ID,
      athleteId,
      isActive,
      updatedAt: new Date().toISOString(),
    })

    revalidatePath(athletesPath(locale))

    return { success: true as const }
  } catch (error) {
    console.error('Error updating athlete active state:', error)

    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'No se pudo actualizar el estado del atleta',
    }
  }
}

export const assignAthleteToGroup = createAthleteGroupAssignmentAction({
  db,
  teamId: CURRENT_TEAM_ID,
  createId: randomUUID,
  now: () => new Date().toISOString(),
  today: getCurrentDateInArgentina,
  revalidatePath,
  redirect,
})
