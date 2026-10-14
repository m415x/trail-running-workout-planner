import { isDeepStrictEqual } from 'node:util'

import {
  buildGenerationExplanation,
  type GenerationExplanation,
} from '@/lib/session-generation/generation-explanation'
import { generateWeeklySessionProposals } from '@/lib/session-generation/session-proposal-generator'
import { groupSharedSessionEvents } from '@/lib/session-generation/shared-session-events'
import type {
  SessionGenerationInput,
  SharedSessionGenerationResult,
} from '@/types/training/session-generation.types'

export interface AuthoritativeGenerationRun {
  input: SessionGenerationInput
  planningCohortId: string | null
}

export interface VerifyGenerationPreviewEquivalenceInput {
  /** Must be resolved independently from authorized server-owned sources. */
  authoritativeRuns: AuthoritativeGenerationRun[]
  /** Untrusted reviewed payload; never an authorization token. */
  reviewedProposal: SharedSessionGenerationResult
  reviewedExplanations: Record<string, GenerationExplanation>
}

/**
 * KAN-787/T3a: pure feasibility check. Replays the exact preview generator
 * pipeline from caller-supplied authoritative inputs and compares the entire
 * proposal and every structured causal fact, including scope and stage order.
 *
 * This does NOT load/authorize the inputs, persist snapshots or validate
 * concurrency. Those boundaries must be established before transport changes.
 */
export function verifyGenerationPreviewEquivalence({
  authoritativeRuns,
  reviewedProposal,
  reviewedExplanations,
}: VerifyGenerationPreviewEquivalenceInput): { status: 'equivalent' | 'stale' } {
  const generated = authoritativeRuns.map(({ input }) =>
    generateWeeklySessionProposals(input),
  )
  const actualProposal = groupSharedSessionEvents(generated)
  if (!isDeepStrictEqual(actualProposal, reviewedProposal)) {
    return { status: 'stale' }
  }

  const actualExplanations: Record<string, GenerationExplanation> = {}
  generated.forEach((result, index) => {
    const { input, planningCohortId } = authoritativeRuns[index]
    for (const proposal of result.proposals) {
      if (Object.hasOwn(actualExplanations, proposal.generationKey)) {
        throw new RangeError('Duplicated generation explanation key')
      }
      actualExplanations[proposal.generationKey] = buildGenerationExplanation({
        input,
        result,
        sharedGeneration: actualProposal,
        generationKey: proposal.generationKey,
        planningCohortId,
      })
    }
  })
  return {
    status: isDeepStrictEqual(actualExplanations, reviewedExplanations)
      ? 'equivalent'
      : 'stale',
  }
}
