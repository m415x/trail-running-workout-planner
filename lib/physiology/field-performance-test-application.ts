import type { Track1000mEvaluationInput } from '@/lib/physiology/field-performance-test'
import { projectTrack1000mEvolution, type Track1000mEvolution } from '@/lib/analytics/training/track-1000m-evolution'
import { createTrack1000mEvaluation } from '@/lib/physiology/field-performance-test'
import type {
  InsertFieldPerformanceTest,
} from '@/lib/physiology/field-performance-test-sqlite'
import type { FieldPerformanceTestRow } from '@/lib/physiology/field-performance-test-history'
import { resolveRunningReference, type RunningReference } from '@/lib/physiology/running-reference'

interface FieldPerformanceCreateDependencies {
  resolveOwnedAthlete(athleteId: string): Promise<{ id: string } | null>
  insert(evidence: InsertFieldPerformanceTest): FieldPerformanceTestRow
  newId(): string
  now(): string
}

export type CreateTrack1000mEvidenceResult =
  | { success: true; data: FieldPerformanceTestRow }
  | { success: false; error: 'athlete_not_found' | string }

/**
 * Application boundary for creating observed 1000 m evidence.
 * Ownership is resolved before validation metadata or persistence is performed.
 */
export async function createTrack1000mEvidence(
  input: Track1000mEvaluationInput,
  dependencies: FieldPerformanceCreateDependencies,
): Promise<CreateTrack1000mEvidenceResult> {
  const athlete = await dependencies.resolveOwnedAthlete(input.athleteId)
  if (!athlete) return { success: false, error: 'athlete_not_found' }

  try {
    const evaluation = createTrack1000mEvaluation(input)
    const timestamp = dependencies.now()
    const row = dependencies.insert({
      id: dependencies.newId(),
      ...evaluation,
      notes: evaluation.notes ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    return { success: true, data: row }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'field_performance_test_create_failed',
    }
  }
}



export interface CreateAthleteTrack1000mEvidenceInput {
  readonly athleteId: string
  readonly userId: string
  readonly performedAt: string
  readonly elapsedTimeSec: number
  readonly notes?: string
  readonly executionContext: 'official' | 'self_directed'
  readonly testEventId?: string
}

interface AthleteFieldPerformanceCreateDependencies {
  resolveSelfAthlete(athleteId: string, userId: string): Promise<{ id: string } | null>
  resolveEligibleTestEvent?(testEventId: string, athleteId: string): Promise<{ id: string } | null>
  insert(evidence: InsertFieldPerformanceTest): FieldPerformanceTestRow
  newId(): string
  now(): string
}

/**
 * Athlete-owned creation boundary. Recorder provenance is derived from the
 * authenticated subject rather than accepted from client-controlled input.
 */
export async function createAthleteTrack1000mEvidence(
  input: CreateAthleteTrack1000mEvidenceInput,
  dependencies: AthleteFieldPerformanceCreateDependencies,
): Promise<CreateTrack1000mEvidenceResult> {
  const athlete = await dependencies.resolveSelfAthlete(input.athleteId, input.userId)
  if (!athlete) return { success: false, error: 'athlete_not_found' }

  if (input.executionContext === 'official') {
    if (!input.testEventId) {
      return { success: false, error: 'official evidence requires testEventId' }
    }

    const testEvent = dependencies.resolveEligibleTestEvent
      ? await dependencies.resolveEligibleTestEvent(input.testEventId, athlete.id)
      : null
    if (!testEvent) return { success: false, error: 'test_event_not_found' }
  }

  return createTrack1000mEvidence(
    {
      athleteId: athlete.id,
      performedAt: input.performedAt,
      elapsedTimeSec: input.elapsedTimeSec,
      notes: input.notes,
      executionContext: input.executionContext,
      testEventId: input.testEventId,
      recordedBy: 'athlete',
      recordedByUserId: input.userId,
    },
    {
      resolveOwnedAthlete: async id => id === athlete.id ? athlete : null,
      insert: dependencies.insert,
      newId: dependencies.newId,
      now: dependencies.now,
    },
  )
}

export interface CreateCoachTrack1000mEvidenceInput {
  readonly athleteId: string
  readonly coachUserId: string
  readonly performedAt: string
  readonly elapsedTimeSec: number
  readonly notes?: string
  readonly testEventId: string
}

interface CoachFieldPerformanceCreateDependencies {
  resolveOwnedAthlete(athleteId: string): Promise<{ id: string } | null>
  resolveEligibleTestEvent(testEventId: string, athleteId: string): Promise<{ id: string } | null>
  insert(evidence: InsertFieldPerformanceTest): FieldPerformanceTestRow
  newId(): string
  now(): string
}

export async function createCoachTrack1000mEvidence(
  input: CreateCoachTrack1000mEvidenceInput,
  dependencies: CoachFieldPerformanceCreateDependencies,
): Promise<CreateTrack1000mEvidenceResult> {
  const athlete = await dependencies.resolveOwnedAthlete(input.athleteId)
  if (!athlete) return { success: false, error: 'athlete_not_found' }

  const testEvent = await dependencies.resolveEligibleTestEvent(input.testEventId, athlete.id)
  if (!testEvent) return { success: false, error: 'test_event_not_found' }

  return createTrack1000mEvidence(
    {
      athleteId: athlete.id,
      performedAt: input.performedAt,
      elapsedTimeSec: input.elapsedTimeSec,
      notes: input.notes,
      testEventId: testEvent.id,
      executionContext: 'official',
      recordedBy: 'coach',
      recordedByUserId: input.coachUserId,
    },
    {
      resolveOwnedAthlete: async id => id === athlete.id ? athlete : null,
      insert: dependencies.insert,
      newId: dependencies.newId,
      now: dependencies.now,
    },
  )
}

export interface CorrectTrack1000mEvidenceInput {
  readonly athleteId: string
  readonly evidenceId: string
  readonly replacement: Omit<Track1000mEvaluationInput, 'athleteId'>
}

interface FieldPerformanceCorrectionDependencies {
  resolveOwnedAthlete(athleteId: string): Promise<{ id: string } | null>
  getById(id: string): FieldPerformanceTestRow | undefined
  replace(id: string, replacement: InsertFieldPerformanceTest, updatedAt: string): FieldPerformanceTestRow
  newId(): string
  now(): string
}

export type CorrectTrack1000mEvidenceResult =
  | { success: true; data: FieldPerformanceTestRow }
  | { success: false; error: 'athlete_not_found' | 'evidence_not_found' | string }

/**
 * Corrects observed evidence append-only: the owned original is invalidated and
 * a new canonical observation is inserted. Cross-athlete evidence is hidden as
 * not found and never mutated.
 */
export async function correctTrack1000mEvidence(
  input: CorrectTrack1000mEvidenceInput,
  dependencies: FieldPerformanceCorrectionDependencies,
): Promise<CorrectTrack1000mEvidenceResult> {
  const athlete = await dependencies.resolveOwnedAthlete(input.athleteId)
  if (!athlete) return { success: false, error: 'athlete_not_found' }

  const original = dependencies.getById(input.evidenceId)
  if (!original || original.isDeleted || original.athleteId !== athlete.id) {
    return { success: false, error: 'evidence_not_found' }
  }

  try {
    const evaluation = createTrack1000mEvaluation({
      athleteId: athlete.id,
      ...input.replacement,
    })
    const timestamp = dependencies.now()
    const replacement = {
      id: dependencies.newId(),
      ...evaluation,
      notes: evaluation.notes ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    const row = dependencies.replace(original.id, replacement, timestamp)
    return { success: true, data: row }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'field_performance_test_correction_failed',
    }
  }
}


export interface ResolveAthleteRunningReferenceInput {
  readonly athleteId: string
  readonly effectiveDate: string
}

interface RunningReferenceDependencies {
  resolveOwnedAthlete(athleteId: string): Promise<{ id: string } | null>
  listActiveByAthleteThroughDate(
    athleteId: string,
    effectiveDate: string,
  ): FieldPerformanceTestRow[]
}

export type ResolveAthleteRunningReferenceResult =
  | { success: true; data: RunningReference }
  | { success: false; error: 'athlete_not_found' }

/**
 * Authorized application boundary for resolving the running reference that
 * applies to one athlete on an explicit effective date.
 */
export async function resolveAthleteRunningReference(
  input: ResolveAthleteRunningReferenceInput,
  dependencies: RunningReferenceDependencies,
): Promise<ResolveAthleteRunningReferenceResult> {
  const athlete = await dependencies.resolveOwnedAthlete(input.athleteId)
  if (!athlete) return { success: false, error: 'athlete_not_found' }

  const rows = dependencies.listActiveByAthleteThroughDate(
    athlete.id,
    input.effectiveDate,
  )

  return {
    success: true,
    data: resolveRunningReference({
      effectiveDate: input.effectiveDate,
      evidence: rows.map((row) => ({
        evaluationId: row.id,
        performedAt: row.performedAt,
        createdAt: row.createdAt,
        protocol: row.protocol,
        distanceM: row.distanceM,
        elapsedTimeSec: row.elapsedTimeSec,
      })),
    }),
  }
}


export interface ReadAthleteTrack1000mEvolutionInput {
  readonly athleteId: string
}

interface Track1000mEvolutionDependencies {
  resolveOwnedAthlete(athleteId: string): Promise<{ id: string } | null>
  listActiveByAthlete(athleteId: string): FieldPerformanceTestRow[]
}

export type ReadAthleteTrack1000mEvolutionResult =
  | { success: true; data: Track1000mEvolution }
  | { success: false; error: 'athlete_not_found' }

/**
 * Authorized read boundary for factual 1000 m test evolution.
 * Ownership is resolved before evidence is queried, preserving team/athlete
 * isolation independently from any consuming Coach UI.
 */
export async function readAthleteTrack1000mEvolution(
  input: ReadAthleteTrack1000mEvolutionInput,
  dependencies: Track1000mEvolutionDependencies,
): Promise<ReadAthleteTrack1000mEvolutionResult> {
  const athlete = await dependencies.resolveOwnedAthlete(input.athleteId)
  if (!athlete) return { success: false, error: 'athlete_not_found' }

  return {
    success: true,
    data: projectTrack1000mEvolution(
      dependencies.listActiveByAthlete(athlete.id),
      athlete.id,
    ),
  }
}
