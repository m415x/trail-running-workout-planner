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
  type CorrectTrack1000mEvidenceInput,
  type CreateAthleteTrack1000mEvidenceInput,
  type CreateCoachTrack1000mEvidenceInput,
  type ReviewCoachTrack1000mEvidenceInput,
} from '@/lib/physiology/field-performance-test-application'
import type { Track1000mEvaluationInput } from '@/lib/physiology/field-performance-test'
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


function resolveEligibleTestEvent(testEventId: string, athleteId: string) {
  const athlete = db.query.athleteProfiles.findFirst({
    where: eq(athleteProfiles.id, athleteId),
  }).sync()
  if (!athlete?.groupId) return null

  const event = db.query.fieldPerformanceTestEvents.findFirst({
    where: and(
      eq(fieldPerformanceTestEvents.id, testEventId),
      eq(fieldPerformanceTestEvents.teamId, athlete.teamId),
      eq(fieldPerformanceTestEvents.groupId, athlete.groupId),
      eq(fieldPerformanceTestEvents.isDeleted, false),
    ),
  }).sync()

  return event ? { id: event.id } : null
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

  const data = await db.query.fieldPerformanceTestEvents.findMany({
    where: and(
      eq(fieldPerformanceTestEvents.teamId, athlete.teamId),
      eq(fieldPerformanceTestEvents.groupId, groupId),
      eq(fieldPerformanceTestEvents.protocol, '1000m_track'),
      eq(fieldPerformanceTestEvents.isDeleted, false),
    ),
  })

  return { success: true as const, data }
}

export async function getCurrentAthleteTrack1000mEvidenceAction(
  input: Omit<CreateAthleteTrack1000mEvidenceInput, 'athleteId' | 'userId'>,
) {
  const currentAthlete = await getCurrentAthlete()
  if (!currentAthlete.success || !currentAthlete.data?.athleteProfile) {
    return { success: false as const, error: 'athlete_not_found' as const }
  }

  return createAthleteTrack1000mEvidence(
    {
      ...input,
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
  input: CreateCoachTrack1000mEvidenceInput,
) {
  return createCoachTrack1000mEvidence(input, {
    ...dependencies,
    resolveEligibleTestEvent: async (testEventId, athleteId) =>
      resolveEligibleTestEvent(testEventId, athleteId),
  })
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
