import type {
  CompetitionContext,
  CompetitionContextEntry,
} from '@/types/training/competition-context.types'

export interface CompetitionAnalyticsProjection {
  readonly primaryCompetition: CompetitionContextEntry | null
  readonly intermediateCompetitions: readonly CompetitionContextEntry[]
}

/** Factual context only: no readiness, prediction, diagnosis or recommendation. */
export function projectCompetitionAnalytics(
  source: CompetitionContext,
): CompetitionAnalyticsProjection {
  return {
    primaryCompetition: source.primaryCompetition,
    intermediateCompetitions: source.intermediateCompetitions,
  }
}
