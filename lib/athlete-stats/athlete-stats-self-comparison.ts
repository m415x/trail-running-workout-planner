import { and, eq, gte, lte } from 'drizzle-orm'
import { db } from '@/db'
import { athleteProfiles, groupSessionPrescriptions, groupTrainingPlans, macrocycles, mesocycles, microcycles, sessions } from '@/db/schema'
import { getSelfPlanningResolutionOnDate } from './athlete-stats-self-planning'
import { listRealizedTrainingRecordsForAthleteInDateRange } from '@/lib/realized-training/realized-training-repository'
import { buildAthletePlanRealComparison } from '@/lib/realized-training/plan-real-comparison-service'
import type { PlanRealComparisonWindow, PlanRealMetricOperand, PlanRealPlanningResolutionLimitation } from '@/types/training/plan-real-comparison.types'

/** Server-side SELF domain query. Caller must have resolved H5B Stats authority. */
function plannedNumericOperand(
  value: number | null,
  unit: 'km' | 'min' | 'm',
): PlanRealMetricOperand {
  return value === null
    ? { state: 'unknown', reason: 'not_prescribed', unit }
    : { state: 'known', value, unit }
}

function plannedIntensityOperand(input: {
  intensityMethod: 'hr_zone' | 'reference_percentage' | null
  zone: string | null
  referencePercentage: number | null
}): PlanRealMetricOperand {
  if (input.intensityMethod === 'hr_zone' && input.zone !== null) {
    return { state: 'known', value: input.zone, unit: 'hr_zone' }
  }
  if (input.intensityMethod === 'reference_percentage' && input.referencePercentage !== null) {
    return { state: 'known', value: input.referencePercentage, unit: 'reference_percent' }
  }
  return { state: 'unknown', reason: 'not_prescribed', unit: null }
}

export async function getSelfAthletePlanRealComparison(
  athleteId: string,
  teamId: string,
  window: PlanRealComparisonWindow,
) {
  const athlete = db.select({ id: athleteProfiles.id, teamId: athleteProfiles.teamId })
    .from(athleteProfiles)
    .where(and(eq(athleteProfiles.id, athleteId), eq(athleteProfiles.teamId, teamId), eq(athleteProfiles.isDeleted, false)))
    .get()
  if (!athlete) throw new Error('Athlete Stats SELF subject unavailable')

  if (window.startDate > window.endDate) {
    return { success: false as const, data: null }
  }

  const [records, candidateSessions] = await Promise.all([
    Promise.resolve(listRealizedTrainingRecordsForAthleteInDateRange(
      athlete.id,
      athlete.teamId,
      window.startDate,
      window.endDate,
    )),
    Promise.resolve(db
      .select({
        id: sessions.id,
        date: sessions.date,
        title: sessions.title,
        planId: groupTrainingPlans.id,
        distanceKm: groupSessionPrescriptions.distanceKm,
        durationMin: groupSessionPrescriptions.durationMin,
        elevationGainM: groupSessionPrescriptions.elevationGain,
        intensityMethod: groupSessionPrescriptions.intensityMethod,
        zone: groupSessionPrescriptions.zone,
        referencePercentage: groupSessionPrescriptions.referencePercentage,
      })
      .from(sessions)
      .innerJoin(
        groupSessionPrescriptions,
        and(
          eq(groupSessionPrescriptions.sessionId, sessions.id),
          eq(groupSessionPrescriptions.isDeleted, false),
        ),
      )
      .innerJoin(microcycles, eq(groupSessionPrescriptions.microcycleId, microcycles.id))
      .innerJoin(mesocycles, eq(microcycles.mesocycleId, mesocycles.id))
      .innerJoin(macrocycles, eq(mesocycles.macrocycleId, macrocycles.id))
      .innerJoin(groupTrainingPlans, eq(macrocycles.groupTrainingPlanId, groupTrainingPlans.id))
      .where(and(
        eq(sessions.teamId, athlete.teamId),
        gte(sessions.date, window.startDate),
        lte(sessions.date, window.endDate),
        eq(sessions.isDeleted, false),
        eq(microcycles.isDeleted, false),
        eq(mesocycles.isDeleted, false),
        eq(macrocycles.isDeleted, false),
        eq(groupTrainingPlans.isDeleted, false),
      ))
      .all()),
  ])

  const dates = [...new Set(candidateSessions.map(session => session.date))]
  const datedResolutions = await Promise.all(dates.map(async date => ({
    date,
    result: await getSelfPlanningResolutionOnDate(athlete.id, teamId, date),
  })))
  const resolutionByDate = new Map(datedResolutions.map(item => [item.date, item.result?.resolution ?? null]))

  const plannedSessions = candidateSessions.flatMap(session => {
    const resolution = resolutionByDate.get(session.date)
    if (!resolution || resolution.status !== 'resolved' || resolution.planId !== session.planId) {
      return []
    }

    return [{
      teamId: athlete.teamId,
      athleteId: athlete.id,
      date: session.date,
      sessionId: session.id,
      sessionTitle: session.title,
      planning: {
        source: resolution.source,
        teamId: athlete.teamId,
        groupId: resolution.groupId,
        planId: resolution.planId,
        cohortId: resolution.cohortId,
      },
      metrics: {
        distanceKm: plannedNumericOperand(session.distanceKm, 'km'),
        durationMin: plannedNumericOperand(session.durationMin, 'min'),
        elevationGainM: plannedNumericOperand(session.elevationGainM, 'm'),
        intensity: plannedIntensityOperand(session),
      },
    }]
  })

  const planningLimitations: PlanRealPlanningResolutionLimitation[] = []
  for (const { date, result } of datedResolutions) {
    const resolution = result?.resolution
    if (!resolution || resolution.status === 'resolved') continue

    if (resolution.status === 'none') {
      planningLimitations.push({
        date,
        status: 'none',
        reason: resolution.reason,
        conflictingIds: [],
      })
    } else {
      planningLimitations.push({
        date,
        status: 'conflict',
        reason: resolution.reason,
        conflictingIds: resolution.conflictingIds,
      })
    }
  }

  return {
    success: true as const,
    data: buildAthletePlanRealComparison({
      teamId: athlete.teamId,
      athleteId: athlete.id,
      window,
      plannedSessions,
      realizedRecords: records,
      planningLimitations,
    }),
  }
}

