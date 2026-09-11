import { isCompetitionActiveForPlanning } from '@/lib/periodization/competition-lifecycle'
import { resolvePrimaryCompetitionCandidate } from '@/lib/periodization/competition-priority'
import type { CompetitionEntry } from '@/types/training/competition-entry.types'
import type {
  CompetitionContextEntry,
  CompetitionContextResult,
} from '@/types/training/competition-context.types'

function toContextEntry(entry: CompetitionEntry): CompetitionContextEntry {
  return {
    id: entry.id,
    name: entry.name,
    date: entry.date,
    distanceKm: entry.distanceKm,
    ...(entry.elevationGainM === null || entry.elevationGainM === undefined
      ? {}
      : { elevationGain: entry.elevationGainM }),
    priority: entry.priority,
  }
}

/**
 * Derives the competitive boundary consumed by planning from persisted entries.
 *
 * The input must already be scoped to the relevant planning horizon. This
 * boundary owns lifecycle filtering and priority interpretation so generators
 * never query CompetitionEntry persistence directly. Completed, cancelled and
 * logically deleted records remain historical data and are excluded.
 */
export function deriveCompetitionContext(
  entries: readonly CompetitionEntry[],
): CompetitionContextResult {
  const activeEntries = entries.filter(
    (entry) => !entry.isDeleted && isCompetitionActiveForPlanning(entry.status),
  )

  const primaryResult = resolvePrimaryCompetitionCandidate(activeEntries)
  if (!primaryResult.valid) {
    return {
      valid: false,
      errors: ['competition_context_multiple_primary_candidates'],
    }
  }

  return {
    valid: true,
    context: {
      primaryCompetition: primaryResult.primaryCandidate
        ? toContextEntry(primaryResult.primaryCandidate)
        : null,
      intermediateCompetitions: activeEntries
        .filter((entry) => entry.priority === 'B' || entry.priority === 'C')
        .map(toContextEntry),
    },
  }
}
