'use server'

import { and, asc, eq, gte, lte } from 'drizzle-orm'

import { db } from '@/db'
import { athleteProfiles, sessions, shoes, users } from '@/db/schema'

const CURRENT_USER_ID = 'user_1'
const CURRENT_ATHLETE_PROFILE_ID = 'profile_user_1'

function formatISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getCurrentMonday() {
  const date = new Date()
  const day = date.getDay()
  const difference = date.getDate() - day + (day === 0 ? -6 : 1)

  date.setDate(difference)
  date.setHours(0, 0, 0, 0)

  return formatISODate(date)
}

export async function getCurrentAthlete() {
  try {
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, CURRENT_USER_ID), eq(users.isDeleted, false)),

      with: {
        athleteProfile: {
          with: {
            team: true,
            group: true,
          },
        },
      },
    })

    if (!user?.athleteProfile) {
      throw new Error('Atleta no encontrado')
    }

    return {
      success: true,
      data: user,
    }
  } catch (error) {
    console.error('Error fetching athlete:', error)

    return {
      success: false,
      error: 'No se pudo cargar el perfil del atleta',
    }
  }
}

export async function getWeeklySchedule(startDateIso: string = getCurrentMonday()) {
  try {
    const endDate = new Date(`${startDateIso}T00:00:00`)
    endDate.setDate(endDate.getDate() + 6)

    const schedule = await db.query.sessions.findMany({
      where: and(
        gte(sessions.date, startDateIso),
        lte(sessions.date, formatISODate(endDate)),
        eq(sessions.isDeleted, false),
      ),
      orderBy: asc(sessions.date),
      with: {
        workout: true,
      },
    })

    return {
      success: true,
      data: schedule,
    }
  } catch (error) {
    console.error('Error fetching weekly schedule:', error)

    return {
      success: false,
      error: 'No se pudo cargar el calendario semanal',
    }
  }
}

export async function getAthleteShoes() {
  try {
    const athleteShoes = await db.query.shoes.findMany({
      where: and(eq(shoes.athleteId, CURRENT_ATHLETE_PROFILE_ID), eq(shoes.isActive, true), eq(shoes.isDeleted, false)),

      orderBy: asc(shoes.isDefault),
    })

    return {
      success: true,
      data: athleteShoes,
    }
  } catch (error) {
    console.error('Error fetching shoes:', error)

    return {
      success: false,
      error: 'No se pudo cargar el calzado',
    }
  }
}
