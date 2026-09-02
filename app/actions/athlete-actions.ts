'use server'

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { athleteGroups, athleteProfiles, groupHistoryRecords } from '@/db/schema'

interface ChangeAthleteGroupInput {
  athleteId: string
  newGroupId: string
  changedByUserId: string
  effectiveDate: string
  reason?: string
}

const CURRENT_TEAM_ID = 'team_1'

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

export async function changeAthleteGroup(input: ChangeAthleteGroupInput) {
  try {
    await db.transaction(async (tx) => {
      const athlete = await tx.query.athleteProfiles.findFirst({
        where: and(eq(athleteProfiles.id, input.athleteId), eq(athleteProfiles.isDeleted, false)),
      })

      if (!athlete) {
        throw new Error('Atleta no encontrado')
      }

      const newGroup = await tx.query.athleteGroups.findFirst({
        where: and(
          eq(athleteGroups.id, input.newGroupId),
          eq(athleteGroups.isActive, true),
          eq(athleteGroups.isDeleted, false),
        ),
      })

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

      await tx
        .update(athleteProfiles)
        .set({
          groupId: newGroup.id,
          updatedAt: now,
        })
        .where(eq(athleteProfiles.id, athlete.id))

      await tx.insert(groupHistoryRecords).values({
        id: randomUUID(),
        athleteId: athlete.id,
        previousGroupId: athlete.groupId,
        newGroupId: newGroup.id,
        changedByUserId: input.changedByUserId,
        date: input.effectiveDate,
        reason: input.reason ?? null,
        createdAt: now,
        updatedAt: now,
      })
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
