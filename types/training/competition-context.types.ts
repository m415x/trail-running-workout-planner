export interface CompetitionContextEntry {
  /** Source CompetitionEntry id retained for traceability without persistence access. */
  readonly id: string
  readonly name: string
  /** Calendar date in YYYY-MM-DD format. */
  readonly date: string
  /** Competitive distance in kilometers. */
  readonly distanceKm: number
  /** Positive elevation gain in meters (m+), when known. */
  readonly elevationGain?: number
  readonly priority: 'A' | 'B' | 'C'
}

/**
 * Pure competitive context consumed by planning logic.
 *
 * It contains only information relevant to planning and deliberately omits
 * persistence metadata and lifecycle implementation details. The caller must
 * provide entries already scoped to the planning horizon; derivation filters
 * lifecycle-inactive competitions before building this context.
 */
export interface CompetitionContext {
  /** Unique active A-priority competition, when one exists. */
  readonly primaryCompetition: CompetitionContextEntry | null
  /** Active B/C competitions that provide intermediate competitive context. */
  readonly intermediateCompetitions: readonly CompetitionContextEntry[]
}

export type CompetitionContextErrorCode =
  'competition_context_multiple_primary_candidates'

export type CompetitionContextResult =
  | {
      readonly valid: true
      readonly context: CompetitionContext
    }
  | {
      readonly valid: false
      readonly errors: readonly CompetitionContextErrorCode[]
    }
