'use server'

import { randomUUID } from 'node:crypto'
import { and, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { db } from '@/db'
import { athleteGroups, athleteProfiles, groupHistoryRecords, users } from '@/db/schema'

interface ChangeAthleteGroupInput {
  athleteId: string
  newGroupId: string
  changedByUserId: string
  effectiveDate: string
  reason?: string
}

export interface AthleteFormState {
  error?: string
}

const CURRENT_TEAM_ID = 'team_1'

const athleteFormSchema = z.object({
  firstName: z.string().trim().min(2, 'Ingresá el nombre del atleta'),
  lastName: z.string().trim().min(2, 'Ingresá el apellido del atleta'),
  email: z.email('Ingresá un email válido').transform((value) => value.toLowerCase()),
  dni: z.string().trim().min(6, 'Ingresá un DNI válido'),
  nickName: z.string().trim().optional(),
  birthday: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  emergencyContact: z.string().trim().optional(),
  emergencyPhone: z.string().trim().optional(),
  locale: z.string().trim().default('es'),
})

function nullable(value?: string) {
  return value || null
}

function athletesPath(locale: string) {
  return locale === 'es' ? '/dashboard/athletes' : `/${locale}/dashboard/athletes`
}

export async function getAthletesByTeam(teamId: string = CURRENT_TEAM_ID) {
  try {
    const athletes = await db.query.athleteProfiles.findMany({
      where: and(eq(athleteProfiles.teamId, teamId), eq(athleteProfiles.isDeleted, false)),
      with: {
        user: true,
        group: true,
      },
    })

    athletes.sort((first, second) => {
      const firstName = `${first.user.lastName} ${first.user.firstName}`
      const secondName = `${second.user.lastName} ${second.user.firstName}`

      return firstName.localeCompare(secondName, 'es')
    })

    return {
      success: true as const,
      data: athletes,
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
  return db.query.athleteProfiles.findFirst({
    where: and(eq(athleteProfiles.id, athleteId), eq(athleteProfiles.isDeleted, false)),
    with: {
      user: true,
      group: true,
    },
  })
}

export async function createAthlete(_previousState: AthleteFormState, formData: FormData): Promise<AthleteFormState> {
  const parsed = athleteFormSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisá los datos ingresados' }
  }

  const data = parsed.data

  try {
    db.transaction((tx) => {
      const existingUser = tx.query.users.findFirst({
        where: eq(users.email, data.email),
      }).sync()

      if (existingUser) {
        throw new Error('Ya existe un usuario con ese email')
      }

      const existingDni = tx.query.athleteProfiles.findFirst({
        where: and(eq(athleteProfiles.dni, data.dni), eq(athleteProfiles.isDeleted, false)),
      }).sync()

      if (existingDni) {
        throw new Error('Ya existe un atleta con ese DNI')
      }

      const now = new Date().toISOString()
      const userId = randomUUID()
      const athleteId = randomUUID()

      tx.insert(users).values({
        id: userId,
        role: 'athlete',
        userName: data.email,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        createdAt: now,
        updatedAt: now,
      }).run()

      tx.insert(athleteProfiles).values({
        id: athleteId,
        userId,
        teamId: CURRENT_TEAM_ID,
        groupId: null,
        nickName: nullable(data.nickName),
        dni: data.dni,
        birthday: nullable(data.birthday),
        phone: nullable(data.phone),
        emergencyContact: nullable(data.emergencyContact),
        emergencyPhone: nullable(data.emergencyPhone),
        createdAt: now,
        updatedAt: now,
      }).run()
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
  const parsed = athleteFormSchema.safeParse(Object.fromEntries(formData))

  if (!athleteId) {
    return { error: 'No se pudo identificar al atleta' }
  }

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisá los datos ingresados' }
  }

  const data = parsed.data

  try {
    db.transaction((tx) => {
      const athlete = tx.query.athleteProfiles.findFirst({
        where: and(eq(athleteProfiles.id, athleteId), eq(athleteProfiles.isDeleted, false)),
      }).sync()

      if (!athlete) {
        throw new Error('Atleta no encontrado')
      }

      const duplicateEmail = tx.query.users.findFirst({
        where: and(eq(users.email, data.email), ne(users.id, athlete.userId)),
      }).sync()

      if (duplicateEmail) {
        throw new Error('Ya existe un usuario con ese email')
      }

      const duplicateDni = tx.query.athleteProfiles.findFirst({
        where: and(
          eq(athleteProfiles.dni, data.dni),
          ne(athleteProfiles.id, athlete.id),
          eq(athleteProfiles.isDeleted, false),
        ),
      }).sync()

      if (duplicateDni) {
        throw new Error('Ya existe un atleta con ese DNI')
      }

      const now = new Date().toISOString()

      tx
        .update(users)
        .set({
          userName: data.email,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          updatedAt: now,
        })
        .where(eq(users.id, athlete.userId))
        .run()

      tx
        .update(athleteProfiles)
        .set({
          nickName: nullable(data.nickName),
          dni: data.dni,
          birthday: nullable(data.birthday),
          phone: nullable(data.phone),
          emergencyContact: nullable(data.emergencyContact),
          emergencyPhone: nullable(data.emergencyPhone),
          updatedAt: now,
        })
        .where(eq(athleteProfiles.id, athlete.id))
        .run()
    })
  } catch (error) {
    console.error('Error updating athlete:', error)
    return { error: error instanceof Error ? error.message : 'No se pudo actualizar el atleta' }
  }

  const path = athletesPath(data.locale)
  revalidatePath(path)
  redirect(path)
}

export async function changeAthleteGroup(input: ChangeAthleteGroupInput) {
  try {
    db.transaction((tx) => {
      const athlete = tx.query.athleteProfiles.findFirst({
        where: and(eq(athleteProfiles.id, input.athleteId), eq(athleteProfiles.isDeleted, false)),
      }).sync()

      if (!athlete) {
        throw new Error('Atleta no encontrado')
      }

      const newGroup = tx.query.athleteGroups.findFirst({
        where: and(
          eq(athleteGroups.id, input.newGroupId),
          eq(athleteGroups.isActive, true),
          eq(athleteGroups.isDeleted, false),
        ),
      }).sync()

      if (!newGroup) {
        throw new Error('Grupo no encontrado o inactivo')
      }

      if (newGroup.teamId !== athlete.teamId) {
        throw new Error('El grupo seleccionado pertenece a otro equipo')
      }

      if (athlete.groupId === newGroup.id) {
        return
      }

      const now = new Date().toISOString()

      tx
        .update(athleteProfiles)
        .set({
          groupId: newGroup.id,
          updatedAt: now,
        })
        .where(eq(athleteProfiles.id, athlete.id))
        .run()

      tx.insert(groupHistoryRecords).values({
        id: randomUUID(),
        athleteId: athlete.id,
        previousGroupId: athlete.groupId,
        newGroupId: newGroup.id,
        changedByUserId: input.changedByUserId,
        date: input.effectiveDate,
        reason: input.reason ?? null,
        createdAt: now,
        updatedAt: now,
      }).run()
    })

    return { success: true }
  } catch (error) {
    console.error('Error changing athlete group:', error)

    return {
      success: false,
      error: error instanceof Error ? error.message : 'No se pudo cambiar el grupo',
    }
  }
}
