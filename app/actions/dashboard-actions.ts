'use server'

import { and, asc, eq, gte, lte } from 'drizzle-orm'

import { db } from '@/db'
import { athleteProfiles, groupSessionPrescriptions, sessions, shoes, users } from '@/db/schema'

const CURRENT_USER_ID = 'user_1'
const CURRENT_ATHLETE_PROFILE_ID = 'profile_user_1'

function formatISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
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

export type CurrentAthleteData = NonNullable<Awaited<ReturnType<typeof getCurrentAthlete>>['data']>

export async function getWeeklySchedule(
  startDateIso: string = getMondayFromISODate(getCurrentDateInArgentina()),
) {
  try {
    const athlete = await db.query.athleteProfiles.findFirst({
      where: and(eq(athleteProfiles.id, CURRENT_ATHLETE_PROFILE_ID), eq(athleteProfiles.isDeleted, false)),
    })

    if (!athlete?.groupId) {
      return { success: true, data: [] }
    }

    const endDate = new Date(`${startDateIso}T00:00:00`)
    endDate.setDate(endDate.getDate() + 6)

    const schedule = await db.query.sessions.findMany({
      where: and(
        eq(sessions.teamId, athlete.teamId),
        gte(sessions.date, startDateIso),
        lte(sessions.date, formatISODate(endDate)),
        eq(sessions.isDeleted, false),
      ),
      orderBy: asc(sessions.date),
      with: {
        workout: true,
        location: true,
        sessionPrescriptions: {
          where: and(
            eq(groupSessionPrescriptions.groupId, athlete.groupId),
            eq(groupSessionPrescriptions.isDeleted, false),
          ),
        },
      },
    })

    return {
      success: true,
      data: schedule.filter((session) => session.sessionPrescriptions.length > 0),
    }
  } catch (error) {
    console.error('Error fetching weekly schedule:', error)

    return {
      success: false,
      error: 'No se pudo cargar el calendario semanal',
    }
  }
}

export async function getCurrentAthletePlanningWeek() {
  try {
    const athlete = await db.query.athleteProfiles.findFirst({
      where: and(eq(athleteProfiles.id, CURRENT_ATHLETE_PROFILE_ID), eq(athleteProfiles.isDeleted, false)),
      with: { group: true },
    })

    if (!athlete) throw new Error('Atleta no encontrado')

    const today = getCurrentDateInArgentina()
    const startDate = getMondayFromISODate(today)
    const endDate = shiftISODate(startDate, 6)

    if (!athlete.groupId) {
      return { success: true, data: { athlete, today, startDate, endDate, sessions: [] } }
    }

    const weekSessions = await db.query.sessions.findMany({
      where: and(
        eq(sessions.teamId, athlete.teamId),
        gte(sessions.date, startDate),
        lte(sessions.date, endDate),
        eq(sessions.isDeleted, false),
      ),
      orderBy: asc(sessions.date),
      with: {
        location: true,
        sessionPrescriptions: {
          where: and(
            eq(groupSessionPrescriptions.groupId, athlete.groupId),
            eq(groupSessionPrescriptions.isDeleted, false),
          ),
        },
      },
    })

    return {
      success: true,
      data: {
        athlete,
        today,
        startDate,
        endDate,
        sessions: weekSessions.filter((session) => session.sessionPrescriptions.length > 0),
      },
    }
  } catch (error) {
    console.error('Error fetching athlete planning week:', error)
    return { success: false, error: 'No se pudo cargar la planificación de la semana' }
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

function getCurrentDateInArgentina() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function getMondayFromISODate(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  const offset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - offset)
  return formatUTCISODate(date)
}

function shiftISODate(value: string, amount: number) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return formatUTCISODate(date)
}

function formatUTCISODate(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
