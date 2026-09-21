'use server'

import { randomUUID } from 'node:crypto'

import { getAthleteById } from '@/app/actions/athlete-actions'
import { getCurrentAthlete } from '@/app/actions/dashboard-actions'
import { db } from '@/db'
import { and, eq } from 'drizzle-orm'
import { athleteProfiles, fieldPerformanceTestEvents } from '@/db/schema'
import {
  correctTrack1000mEvidence,
  createAthleteTrack1000mEvidence,
  createCoachTrack1000mEvidence,
  createTrack1000mEvidence,
  reviewCoachTrack1000mEvidence,
  readAthleteTrack1000mEvolution,
  resolveAthleteRunningReference,
  type CorrectTrack1000mEvidenceInput,
  type CreateAthleteTrack1000mEvidenceInput,
  type CreateCoachTrack1000mEvidenceInput,
  type ReviewCoachTrack1000mEvidenceInput,
} from '@/lib/physiology/field-performance-test-application'
import type { Track1000mEvaluationInput } from '@/lib/physiology/field-performance-test'
import { listEligibleFieldPerformanceTestHistory } from '@/lib/physiology/field-performance-test-history'
import { projectTrack1000mEvolution } from '@/lib/analytics/training/track-1000m-evolution'
import { resolveRunningReference } from '@/lib/physiology/running-reference'
import { createSqliteFieldPerformanceTestRepository } from '@/lib/physiology/field-performance-test-sqlite'

const repository = createSqliteFieldPerformanceTestRepository(db)

const dependencies = {
  resolveOwnedAthlete: async (athleteId: string) => {
    const athlete = await getAthleteById(athleteId)
    return athlete ? { id: athlete.id } : null
  },
  insert: repository.insert,
  newId: randomUUID,
  now: () => new Date().toISOString(),
}

export async function createTrack1000mEvidenceAction(input: Track1000mEvaluationInput) {
  return createTrack1000mEvidence(input, dependencies)
}

export async function correctTrack1000mEvidenceAction(input: CorrectTrack1000mEvidenceInput) {
  return correctTrack1000mEvidence(input, {
    ...dependencies,
    getById: repository.getById,
    replace: repository.replace,
  })
}


function testEventPerformedAt(scheduledAt: string) {
  return scheduledAt.slice(0, 10)
}

function resolveEligibleTrack1000mTestEvents(athlete: { teamId: string; groupId: string }) {
  return db.query.fieldPerformanceTestEvents.findMany({
    where: and(
      eq(fieldPerformanceTestEvents.teamId, athlete.teamId),
      eq(fieldPerformanceTestEvents.groupId, athlete.groupId),
      eq(fieldPerformanceTestEvents.protocol, '1000m_track'),
      eq(fieldPerformanceTestEvents.isDeleted, false),
    ),
  })
}

async function resolveEligibleTestEvent(testEventId: string, athleteId: string) {
  const athlete = db.query.athleteProfiles.findFirst({
    where: eq(athleteProfiles.id, athleteId),
  }).sync()
  if (!athlete?.groupId) return null

  const events = await resolveEligibleTrack1000mTestEvents({
    teamId: athlete.teamId,
    groupId: athlete.groupId,
  })
  const event = events.find((candidate) => candidate.id === testEventId)

  return event ? { id: event.id, scheduledAt: event.scheduledAt } : null
}

export async function getCurrentAthleteTrack1000mTestEventsAction() {
  const currentAthlete = await getCurrentAthlete()
  if (!currentAthlete.success || !currentAthlete.data?.athleteProfile) {
    return { success: false as const, error: 'athlete_not_found' as const }
  }

  const athlete = currentAthlete.data.athleteProfile
  const groupId = athlete.groupId
  if (!groupId) {
    return { success: true as const, data: [] }
  }

  const data = await resolveEligibleTrack1000mTestEvents({
    teamId: athlete.teamId,
    groupId,
  })

  return { success: true as const, data }
}

export async function getCurrentAthleteTrack1000mEvidenceAction(
  input: Omit<CreateAthleteTrack1000mEvidenceInput, 'athleteId' | 'userId' | 'performedAt'> & {
    performedAt?: string
  },
) {
  const currentAthlete = await getCurrentAthlete()
  if (!currentAthlete.success || !currentAthlete.data?.athleteProfile) {
    return { success: false as const, error: 'athlete_not_found' as const }
  }

  let performedAt = input.performedAt
  if (input.executionContext === 'official') {
    if (!input.testEventId) {
      return { success: false as const, error: 'official evidence requires testEventId' }
    }

    const testEvent = await resolveEligibleTestEvent(
      input.testEventId,
      currentAthlete.data.athleteProfile.id,
    )
    if (!testEvent) {
      return { success: false as const, error: 'test_event_not_found' as const }
    }
    performedAt = testEventPerformedAt(testEvent.scheduledAt)
  }

  if (!performedAt) {
    return { success: false as const, error: 'performedAt is required' as const }
  }

  return createAthleteTrack1000mEvidence(
    {
      ...input,
      performedAt,
      athleteId: currentAthlete.data.athleteProfile.id,
      userId: currentAthlete.data.id,
    },
    {
      resolveSelfAthlete: async (athleteId, userId) =>
        athleteId === currentAthlete.data.athleteProfile.id && userId === currentAthlete.data.id
          ? { id: athleteId }
          : null,
      resolveEligibleTestEvent: async (testEventId, athleteId) =>
        resolveEligibleTestEvent(testEventId, athleteId),
      insert: repository.insert,
      newId: randomUUID,
      now: () => new Date().toISOString(),
    },
  )
}

export async function createCoachTrack1000mEvidenceAction(
  input: Omit<CreateCoachTrack1000mEvidenceInput, 'performedAt'>,
) {
  const testEvent = await resolveEligibleTestEvent(input.testEventId, input.athleteId)
  if (!testEvent) {
    return { success: false as const, error: 'test_event_not_found' as const }
  }

  return createCoachTrack1000mEvidence({
    ...input,
    performedAt: testEventPerformedAt(testEvent.scheduledAt),
  }, {
    ...dependencies,
    resolveEligibleTestEvent: async (testEventId, athleteId) =>
      resolveEligibleTestEvent(testEventId, athleteId),
  })
}

export async function getCoachTrack1000mTestEventsAction(athleteId: string) {
  const athlete = await getAthleteById(athleteId)
  if (!athlete) {
    return { success: false as const, error: 'athlete_not_found' as const }
  }

  const groupId = athlete.groupId
  if (!groupId) {
    return { success: true as const, data: [] }
  }

  const data = await resolveEligibleTrack1000mTestEvents({
    teamId: athlete.teamId,
    groupId,
  })

  return { success: true as const, data }
}

export async function getCoachPendingTrack1000mEvidenceAction(athleteId: string) {
  const athlete = await getAthleteById(athleteId)
  if (!athlete) {
    return { success: false as const, error: 'athlete_not_found' as const }
  }

  const data = repository
    .listActiveByAthlete(athlete.id)
    .filter(
      (evidence) =>
        evidence.executionContext === 'self_directed' &&
        evidence.reviewStatus === 'pending_review',
    )

  return { success: true as const, data }
}

export async function reviewCoachTrack1000mEvidenceAction(
  input: ReviewCoachTrack1000mEvidenceInput,
) {
  return reviewCoachTrack1000mEvidence(input, {
    resolveOwnedAthlete: dependencies.resolveOwnedAthlete,
    getById: repository.getById,
    review: repository.review,
    now: dependencies.now,
  })
}


export async function getCoachTrack1000mHistoryAction(athleteId: string, effectiveDate: string) {
  const [evolution, reference] = await Promise.all([
    readAthleteTrack1000mEvolution({ athleteId }, {
      resolveOwnedAthlete: dependencies.resolveOwnedAthlete,
      listActiveByAthlete: repository.listActiveByAthlete,
    }),
    resolveAthleteRunningReference({ athleteId, effectiveDate }, {
      resolveOwnedAthlete: dependencies.resolveOwnedAthlete,
      listActiveByAthleteThroughDate: repository.listActiveByAthleteThroughDate,
    }),
  ])

  if (!evolution.success) return evolution
  if (!reference.success) return reference

  const history = repository.listActiveByAthlete(athleteId)
  const officialResults = history.filter(
    (evidence) =>
      evidence.executionContext === 'official' &&
      evidence.testEventId != null &&
      (evidence.reviewStatus ?? 'accepted') === 'accepted',
  )

  return {
    success: true as const,
    data: {
      evolution: evolution.data,
      reference: reference.data,
      history,
      officialResults,
    },
  }
}


export async function getCurrentAthleteTrack1000mPerformanceAction(effectiveDate: string) {
  const currentAthlete = await getCurrentAthlete()
  if (!currentAthlete.success || !currentAthlete.data?.athleteProfile) {
    return { success: false as const, error: 'athlete_not_found' as const }
  }

  const athleteId = currentAthlete.data.athleteProfile.id
  const eligible = listEligibleFieldPerformanceTestHistory(
    repository.listActiveByAthlete(athleteId),
    athleteId,
    effectiveDate,
  )
  const evolution = projectTrack1000mEvolution(eligible, athleteId)
  const reference = resolveRunningReference({
    effectiveDate,
    evidence: eligible.map((row) => ({
      evaluationId: row.id,
      performedAt: row.performedAt,
      createdAt: row.createdAt,
      protocol: row.protocol,
      distanceM: row.distanceM,
      elapsedTimeSec: row.elapsedTimeSec,
    })),
  })

  return {
    success: true as const,
    data: {
      evolution: {
        comparison: evolution.comparison,
        series: evolution.series.map((point) => {
          const evidence = eligible.find((row) => row.id === point.evaluationId)
          return {
            ...point,
            executionContext: evidence?.executionContext ?? 'official',
          }
        }),
      },
      reference,
    },
  }
}
