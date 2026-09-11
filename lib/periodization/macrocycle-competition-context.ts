import { resolveCompetitionContext } from '@/lib/periodization/legacy-competition-context'

import type { CompetitionEntry, Macrocycle } from '@/types'

export type MacrocycleCompetitionContextInput = {
  readonly competitionEntries: readonly CompetitionEntry[]
  readonly macrocycle: Pick<
    Macrocycle,
    | 'id'
    | 'startDate'
    | 'endDate'
    | 'targetRaceName'
    | 'targetRaceDate'
    | 'targetRaceDistanceKm'
    | 'targetRaceElevationGain'
  >
}

/**
 * Limits plan-level competition rows to the macrocycle horizon before applying
 * H9 precedence and legacy fallback rules.
 *
 * Entries outside the selected macrocycle do not suppress that macrocycle's
 * historical fallback. Entries inside the horizon do, even when lifecycle
 * filtering later makes the derived context neutral.
 */
export function scopeCompetitionEntriesToMacrocycle(
  competitionEntries: readonly CompetitionEntry[],
  macrocycle: Pick<Macrocycle, 'startDate' | 'endDate'>,
): CompetitionEntry[] {
  return competitionEntries.filter((entry) => (
    entry.date >= macrocycle.startDate && entry.date <= macrocycle.endDate
  ))
}

/**
 * Resolves the competitive context for one persisted macrocycle.
 *
 * The live plan calendar has precedence only within this macrocycle's planning
 * horizon. When no applicable CompetitionEntry exists, the KAN-200 legacy
 * adapter may recover context from the immutable target-race snapshot.
 */
export function resolveMacrocycleCompetitionContext({
  competitionEntries,
  macrocycle,
}: MacrocycleCompetitionContextInput) {
  return resolveCompetitionContext({
    competitionEntries: scopeCompetitionEntriesToMacrocycle(
      competitionEntries,
      macrocycle,
    ),
    legacyMacrocycleSnapshot: macrocycle,
  })
}
