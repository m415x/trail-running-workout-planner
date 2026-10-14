import type { GenerationExplanation } from '@/lib/session-generation/generation-explanation'
import type { SharedSessionGenerationResult } from '@/types/training/session-generation.types'
import {
  verifyGenerationPreviewEquivalence,
  type AuthoritativeGenerationRun,
} from './preview-equivalence'

export interface EvaluateAuthoritativeReplayInput {
  /**
   * A trusted, server-owned resolver supplied by a future authenticated
   * application boundary. Browser inputs must never implement this callback.
   */
  resolveRuns(): Promise<readonly AuthoritativeGenerationRun[] | null>
  /** Untrusted proposal displayed to the user. */
  reviewedProposal: SharedSessionGenerationResult
  /** Untrusted causal facts displayed to the user. */
  reviewedExplanations: Record<string, GenerationExplanation>
}

export type AuthoritativeReplayResult =
  | { status: 'unavailable' }
  | { status: 'equivalent' }
  | { status: 'stale' }

/**
 * KAN-787/T3a pure feasibility seam, not a persistence authorization boundary.
 * Missing or throwing source resolution is fail-closed. No returned success
 * establishes transaction freshness or durable provenance.
 */
export async function evaluateAuthoritativeReplay({
  resolveRuns,
  reviewedProposal,
  reviewedExplanations,
}: EvaluateAuthoritativeReplayInput): Promise<AuthoritativeReplayResult> {
  let runs: readonly AuthoritativeGenerationRun[] | null
  try {
    runs = await resolveRuns()
  } catch {
    return { status: 'unavailable' }
  }
  if (!runs) return { status: 'unavailable' }

  try {
    return verifyGenerationPreviewEquivalence({
      authoritativeRuns: [...runs],
      reviewedProposal,
      reviewedExplanations,
    })
  } catch {
    // Duplicate generation keys, malformed inputs, or generator errors must
    // not be interpreted as authorization or equivalent reviewed evidence.
    return { status: 'unavailable' }
  }
}
