import type { Track1000mEvaluationInput } from '@/lib/physiology/field-performance-test'
import { createTrack1000mEvaluation } from '@/lib/physiology/field-performance-test'
import type {
  InsertFieldPerformanceTest,
} from '@/lib/physiology/field-performance-test-sqlite'
import type { FieldPerformanceTestRow } from '@/lib/physiology/field-performance-test-history'

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


export interface CorrectTrack1000mEvidenceInput {
  readonly athleteId: string
  readonly evidenceId: string
  readonly replacement: Omit<Track1000mEvaluationInput, 'athleteId'>
}

interface FieldPerformanceCorrectionDependencies {
  resolveOwnedAthlete(athleteId: string): Promise<{ id: string } | null>
  getById(id: string): FieldPerformanceTestRow | undefined
  invalidate(id: string, updatedAt: string): void
  insert(evidence: InsertFieldPerformanceTest): FieldPerformanceTestRow
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

    dependencies.invalidate(original.id, timestamp)
    const row = dependencies.insert(replacement)
    return { success: true, data: row }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'field_performance_test_correction_failed',
    }
  }
}
