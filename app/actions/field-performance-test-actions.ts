'use server'

import { randomUUID } from 'node:crypto'

import { getAthleteById } from '@/app/actions/athlete-actions'
import { db } from '@/db'
import {
  correctTrack1000mEvidence,
  createTrack1000mEvidence,
  type CorrectTrack1000mEvidenceInput,
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
