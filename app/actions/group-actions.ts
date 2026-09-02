'use server'

import { randomUUID } from 'node:crypto'
import { and, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { db } from '@/db'
import { athleteGroups, athleteProfiles } from '@/db/schema'

const CURRENT_TEAM_ID = 'team_1'

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
  return db.query.athleteGroups.findMany({
    where: and(eq(athleteGroups.teamId, CURRENT_TEAM_ID), eq(athleteGroups.isDeleted, false)),
    orderBy: (groups, { asc }) => [asc(groups.categoryCode), asc(groups.levelCode)],
  })
}

export async function getGroupById(groupId: string) {
  return db.query.athleteGroups.findFirst({
    where: and(
      eq(athleteGroups.id, groupId),
      eq(athleteGroups.teamId, CURRENT_TEAM_ID),
      eq(athleteGroups.isDeleted, false),
    ),
  })
}

export async function getGroupWithMembers(groupId: string) {
  const group = await db.query.athleteGroups.findFirst({
    where: and(
      eq(athleteGroups.id, groupId),
      eq(athleteGroups.teamId, CURRENT_TEAM_ID),
      eq(athleteGroups.isDeleted, false),
    ),
    with: {
      athletes: {
        where: eq(athleteProfiles.isDeleted, false),
        with: {
          user: true,
        },
      },
    },
  })

  if (!group) return null

  group.athletes.sort((first, second) => {
    const firstName = `${first.user.lastName} ${first.user.firstName}`
    const secondName = `${second.user.lastName} ${second.user.firstName}`

    return firstName.localeCompare(secondName, 'es')
  })

  return group
}

export async function createGroup(_previousState: GroupFormState, formData: FormData): Promise<GroupFormState> {
  const parsed = createGroupSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisá los datos ingresados' }
  }

  const data = parsed.data

  try {
    const duplicate = db.query.athleteGroups.findFirst({
      where: and(
        eq(athleteGroups.teamId, CURRENT_TEAM_ID),
        eq(athleteGroups.categoryCode, data.categoryCode),
        eq(athleteGroups.levelCode, data.levelCode),
      ),
    }).sync()

    if (duplicate) {
      return { error: `Ya existe el grupo ${data.categoryCode}${data.levelCode}` }
    }

    const now = new Date().toISOString()

    db.insert(athleteGroups).values({
      id: randomUUID(),
      teamId: CURRENT_TEAM_ID,
      categoryCode: data.categoryCode,
      levelCode: data.levelCode,
      description: data.description || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }).run()
  } catch (error) {
    console.error('Error creating group:', error)
    return { error: 'No se pudo crear el grupo' }
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
    const group = db.query.athleteGroups.findFirst({
      where: and(
        eq(athleteGroups.id, groupId),
        eq(athleteGroups.teamId, CURRENT_TEAM_ID),
        eq(athleteGroups.isDeleted, false),
      ),
    }).sync()

    if (!group) {
      return { error: 'Grupo no encontrado' }
    }

    db.update(athleteGroups)
      .set({
        description: data.description || null,
        isActive: data.isActive,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(athleteGroups.id, group.id), ne(athleteGroups.isDeleted, true)))
      .run()
  } catch (error) {
    console.error('Error updating group:', error)
    return { error: 'No se pudo actualizar el grupo' }
  }

  const path = groupsPath(data.locale)
  revalidatePath(path)
  redirect(path)
}
