'use server'

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { db } from '@/db'
import { athleteGroups } from '@/db/schema'
import { getEligibleAthletesForSportingGroup } from '@/lib/groups/eligible-athletes'
import { getSportingGroupWithMembers } from '@/lib/groups/group-members-read'
import { createSportingGroupAdministration } from '@/lib/groups/create-sporting-group-administration'
import { updateSportingGroupAdministration } from '@/lib/groups/update-sporting-group-administration'
import { createExternalIdentityLookup } from '@/lib/auth/external-identity-lookup'
import { readEptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptAction } from '@/lib/auth/require-authenticated-action'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'
import { createActiveTeamNextServerContext } from '@/lib/authorization/active-team-next-server'
import { createH4aNextServerAuthorizationBoundary } from '@/lib/authorization/h4a-next-server-authorization'

const categoryCodes = ['E', 'U', 'M', 'H', 'S', 'B'] as const
const levelCodes = ['1', '2', '3'] as const
const locales = ['es', 'en'] as const

type SupportedLocale = (typeof locales)[number]

const createGroupSchema = z.object({
  categoryCode: z.enum(categoryCodes),
  levelCode: z.enum(levelCodes),
  description: z.string().trim().optional(),
  locale: z.enum(locales).default('es'),
})

const updateGroupSchema = z.object({
  description: z.string().trim().optional(),
  isActive: z.enum(['true', 'false']).transform((value) => value === 'true'),
  locale: z.enum(locales).default('es'),
})

export interface GroupFormState {
  error?: string
}

function groupsPath(locale: SupportedLocale) {
  return locale === 'es' ? '/dashboard/groups' : `/${locale}/dashboard/groups`
}

export async function getGroupsByTeam() {
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

  const activeTeam = await createActiveTeamNextServerContext().resolve(access.userId)
  if (activeTeam.status !== 'resolved') {
    return {
      success: false as const,
      data: [],
      error: 'No autorizado',
    }
  }

  const authorization = createH4aNextServerAuthorizationBoundary()
  const authorizationResult = await authorization.authorize(access, {
    capability: 'sporting_group.admin.manage',
    resource: { teamId: activeTeam.teamId },
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

  const groups = await db.query.athleteGroups.findMany({
    where: and(
      eq(athleteGroups.teamId, authorizationResult.teamId),
      eq(athleteGroups.isDeleted, false),
    ),
    orderBy: (groups, { asc }) => [asc(groups.categoryCode), asc(groups.levelCode)],
  })

  return {
    success: true as const,
    data: groups,
  }
}

export async function getGroupById(groupId: string) {
  const group = await db.query.athleteGroups.findFirst({
    where: and(
      eq(athleteGroups.id, groupId),
      eq(athleteGroups.isDeleted, false),
    ),
  })

  if (!group) return undefined

  const supabase = await createSupabaseServerClient()
  const lookup = createExternalIdentityLookup()
  const access = await requireAuthenticatedEptAction({
    readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
  })

  if (access.status !== 'authenticated') return undefined

  const authorization = createH4aNextServerAuthorizationBoundary()
  const authorizationResult = await authorization.authorize(access, {
    capability: 'sporting_group.admin.manage',
    resource: { teamId: group.teamId },
    at: new Date().toISOString(),
    requiredScope: 'team',
  })

  if (!authorizationResult.allowed) return undefined

  return group
}

async function authorizeMixedGroupRead(groupId: string) {
  const group = await db.query.athleteGroups.findFirst({
    where: and(
      eq(athleteGroups.id, groupId),
      eq(athleteGroups.isDeleted, false),
    ),
  })

  if (!group) return null

  const supabase = await createSupabaseServerClient()
  const lookup = createExternalIdentityLookup()
  const access = await requireAuthenticatedEptAction({
    readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
  })

  if (access.status !== 'authenticated') return null

  const authorization = createH4aNextServerAuthorizationBoundary()
  const athleteAuthorization = await authorization.authorize(access, {
    capability: 'athlete.admin.manage',
    resource: { teamId: group.teamId },
    at: new Date().toISOString(),
    requiredScope: 'team',
  })
  if (!athleteAuthorization.allowed || !('teamId' in athleteAuthorization)) {
    return null
  }

  const groupAuthorization = await authorization.authorize(access, {
    capability: 'sporting_group.admin.manage',
    resource: { teamId: group.teamId },
    at: new Date().toISOString(),
    requiredScope: 'team',
  })
  if (!groupAuthorization.allowed || !('teamId' in groupAuthorization)) {
    return null
  }

  return {
    group,
    teamId: groupAuthorization.teamId,
  }
}

export async function getEligibleAthletesForGroup(groupId: string) {
  const authorizationResult = await authorizeMixedGroupRead(groupId)
  if (!authorizationResult) return null

  return getEligibleAthletesForSportingGroup({
    db,
    teamId: authorizationResult.teamId,
    groupId,
  })
}

export async function getGroupWithMembers(groupId: string) {
  const authorizationResult = await authorizeMixedGroupRead(groupId)
  if (!authorizationResult) return null

  return getSportingGroupWithMembers({
    db,
    teamId: authorizationResult.teamId,
    groupId,
  })
}

export async function createGroup(_previousState: GroupFormState, formData: FormData): Promise<GroupFormState> {
  const parsed = createGroupSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisá los datos ingresados' }
  }

  const data = parsed.data

  try {
    const supabase = await createSupabaseServerClient()
    const lookup = createExternalIdentityLookup()
    const access = await requireAuthenticatedEptAction({
      readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
    })

    if (access.status !== 'authenticated') {
      return { error: 'No autorizado' }
    }

    const activeTeam = await createActiveTeamNextServerContext().resolve(access.userId)
    if (activeTeam.status !== 'resolved') {
      return { error: 'No autorizado' }
    }

    const authorization = createH4aNextServerAuthorizationBoundary()
    const authorizationResult = await authorization.authorize(access, {
      capability: 'sporting_group.admin.manage',
      resource: { teamId: activeTeam.teamId },
      at: new Date().toISOString(),
      requiredScope: 'team',
    })

    if (!authorizationResult.allowed || !('teamId' in authorizationResult)) {
      return { error: 'No autorizado' }
    }

    createSportingGroupAdministration(db, {
      groupId: randomUUID(),
      teamId: authorizationResult.teamId,
      categoryCode: data.categoryCode,
      levelCode: data.levelCode,
      description: data.description || null,
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error creating group:', error)
    return { error: error instanceof Error ? error.message : 'No se pudo crear el grupo' }
  }

  const path = groupsPath(data.locale)
  revalidatePath(path)
  redirect(path)
}

export async function updateGroup(_previousState: GroupFormState, formData: FormData): Promise<GroupFormState> {
  const groupId = formData.get('groupId')?.toString()
  const parsed = updateGroupSchema.safeParse(Object.fromEntries(formData))

  if (!groupId) {
    return { error: 'No se pudo identificar el grupo' }
  }

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisá los datos ingresados' }
  }

  const data = parsed.data

  try {
    const group = await db.query.athleteGroups.findFirst({
      where: and(
        eq(athleteGroups.id, groupId),
        eq(athleteGroups.isDeleted, false),
      ),
    })

    if (!group) {
      return { error: 'Grupo no encontrado' }
    }

    const supabase = await createSupabaseServerClient()
    const lookup = createExternalIdentityLookup()
    const access = await requireAuthenticatedEptAction({
      readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
    })

    if (access.status !== 'authenticated') {
      return { error: 'No autorizado' }
    }

    const authorization = createH4aNextServerAuthorizationBoundary()
    const authorizationResult = await authorization.authorize(access, {
      capability: 'sporting_group.admin.manage',
      resource: { teamId: group.teamId },
      at: new Date().toISOString(),
      requiredScope: 'team',
    })

    if (!authorizationResult.allowed || !('teamId' in authorizationResult)) {
      return { error: 'No autorizado' }
    }

    updateSportingGroupAdministration(db, {
      groupId,
      teamId: authorizationResult.teamId,
      description: data.description || null,
      isActive: data.isActive,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error updating group:', error)
    return { error: error instanceof Error ? error.message : 'No se pudo actualizar el grupo' }
  }

  const path = groupsPath(data.locale)
  revalidatePath(path)
  redirect(path)
}
