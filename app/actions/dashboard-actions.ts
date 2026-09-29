'use server'

import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm'

import { db } from '@/db'
import {
  athleteProfiles,
  groupHistoryRecords,
  groupSessionPrescriptions,
  groupTrainingPlans,
  macrocycles,
  mesocycles,
  microcycles,
  planningCohortMemberships,
  sessions,
  shoes,
  users,
} from '@/db/schema'
import { resolveAthleteSessionPrescription } from '@/lib/planning-cohorts/athlete-session-prescription'
import { resolveAthletePlanningOnDate } from '@/lib/planning-cohorts/planning-resolution'

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
          where: eq(groupSessionPrescriptions.isDeleted, false),
        },
      },
    })

    const groupChanges = await db.select().from(groupHistoryRecords)
      .where(and(
        eq(groupHistoryRecords.athleteId, athlete.id),
        eq(groupHistoryRecords.isDeleted, false),
      ))

    const memberships = await db.query.planningCohortMemberships.findMany({
      where: and(
        eq(planningCohortMemberships.athleteProfileId, athlete.id),
        eq(planningCohortMemberships.isDeleted, false),
      ),
      with: {
        planningCohort: {
          with: {
            planningVariant: {
              with: {
                macrocycles: true,
              },
            },
          },
        },
      },
    })

    const relevantGroupIds = [...new Set([
      athlete.groupId,
      ...groupChanges.flatMap((change) => [change.previousGroupId, change.newGroupId]),
    ].filter((groupId): groupId is string => groupId !== null))]

    const basePlans = relevantGroupIds.length === 0
      ? []
      : await db.query.groupTrainingPlans.findMany({
          where: and(
            inArray(groupTrainingPlans.groupId, relevantGroupIds),
            eq(groupTrainingPlans.isDeleted, false),
          ),
          with: { macrocycles: true },
        })

    const prescriptionMicrocycleIds = [...new Set(
      weekSessions.flatMap((session) => (
        session.sessionPrescriptions.map((prescription) => prescription.microcycleId)
      )),
    )]
    const prescriptionLineages = prescriptionMicrocycleIds.length === 0
      ? []
      : await db.select({
        microcycleId: microcycles.id,
        groupTrainingPlanId: groupTrainingPlans.id,
      })
        .from(microcycles)
        .innerJoin(mesocycles, eq(microcycles.mesocycleId, mesocycles.id))
        .innerJoin(macrocycles, eq(mesocycles.macrocycleId, macrocycles.id))
        .innerJoin(groupTrainingPlans, eq(macrocycles.groupTrainingPlanId, groupTrainingPlans.id))
        .where(inArray(microcycles.id, prescriptionMicrocycleIds))
    const groupTrainingPlanIdByMicrocycle = new Map(
      prescriptionLineages.map(({ microcycleId, groupTrainingPlanId }) => (
        [microcycleId, groupTrainingPlanId]
      )),
    )

    const resolvedSessions = weekSessions.flatMap((session) => {
      const planning = resolveAthletePlanningOnDate({
        athleteTeamId: athlete.teamId,
        currentGroupId: athlete.groupId,
        groupChanges,
        memberships: memberships.map((membership) => ({
          id: membership.id,
          startDate: membership.startDate,
          endDate: membership.endDate,
          isDeleted: membership.isDeleted,
          cohort: {
            id: membership.planningCohort.id,
            teamId: membership.planningCohort.teamId,
            groupId: membership.planningCohort.groupId,
            status: membership.planningCohort.status,
            isDeleted: membership.planningCohort.isDeleted,
            planningVariant: membership.planningCohort.planningVariant
              ? {
                  id: membership.planningCohort.planningVariant.id,
                  groupId: membership.planningCohort.planningVariant.groupId,
                  planningCohortId: membership.planningCohort.planningVariant.planningCohortId,
                  status: membership.planningCohort.planningVariant.status,
                  isDeleted: membership.planningCohort.planningVariant.isDeleted,
                  macrocycles: membership.planningCohort.planningVariant.macrocycles,
                }
              : null,
          },
        })),
        basePlans: basePlans.map((plan) => ({
          id: plan.id,
          groupId: plan.groupId,
          planningCohortId: plan.planningCohortId,
          status: plan.status,
          isDeleted: plan.isDeleted,
          macrocycles: plan.macrocycles,
        })),
        date: session.date,
      })
      const prescriptionResolution = resolveAthleteSessionPrescription({
        planning,
        prescriptions: session.sessionPrescriptions.flatMap((prescription) => {
          const groupTrainingPlanId = groupTrainingPlanIdByMicrocycle.get(prescription.microcycleId)
          return groupTrainingPlanId
            ? [{
                id: prescription.id,
                groupId: prescription.groupId,
                microcycleId: prescription.microcycleId,
                groupTrainingPlanId,
              }]
            : []
        }),
      })

      if (prescriptionResolution.status !== 'resolved') return []

      return [{
        ...session,
        sessionPrescriptions: session.sessionPrescriptions.filter(
          ({ id }) => id === prescriptionResolution.prescriptionId,
        ),
      }]
    })

    return {
      success: true,
      data: {
        athlete,
        today,
        startDate,
        endDate,
        sessions: resolvedSessions,
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
