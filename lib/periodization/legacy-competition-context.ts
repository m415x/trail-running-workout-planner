import { deriveCompetitionContext } from '@/lib/periodization/competition-context'

import type {
  CompetitionContext,
  CompetitionContextErrorCode,
  CompetitionEntry,
  Macrocycle,
} from '@/types'

export type CompetitionContextSource =
  | 'competition_calendar'
  | 'legacy_snapshot'
  | 'legacy_snapshot_incomplete'
  | 'none'

export type ResolvedCompetitionContext =
  | {
      readonly valid: true
      readonly context: CompetitionContext
      readonly source: CompetitionContextSource
    }
  | {
      readonly valid: false
      readonly errors: readonly CompetitionContextErrorCode[]
    }

const EMPTY_COMPETITION_CONTEXT: CompetitionContext = {
  primaryCompetition: null,
  intermediateCompetitions: [],
}

export type LegacyTargetRaceSnapshot = Pick<
  Macrocycle,
  | 'id'
  | 'targetRaceName'
  | 'targetRaceDate'
  | 'targetRaceDistanceKm'
  | 'targetRaceElevationGain'
>

function hasLegacyTargetRaceSnapshot(snapshot: LegacyTargetRaceSnapshot): boolean {
  return Boolean(
    snapshot.targetRaceName
    || snapshot.targetRaceDate
    || snapshot.targetRaceDistanceKm !== null
      && snapshot.targetRaceDistanceKm !== undefined
    || snapshot.targetRaceElevationGain !== null
      && snapshot.targetRaceElevationGain !== undefined,
  )
}

/**
 * Adapts a complete historical target-race snapshot to the H9 planning boundary.
 *
 * Legacy snapshots without a race date cannot safely become competitive context:
 * inventing a date would alter the historical meaning established by KAN-199.
 */
export function adaptLegacyTargetRaceSnapshot(
  snapshot: LegacyTargetRaceSnapshot,
): CompetitionContext | null {
  const name = snapshot.targetRaceName?.trim() ?? ''
  const date = snapshot.targetRaceDate?.trim() ?? ''
  const distanceKm = snapshot.targetRaceDistanceKm
  const elevationGain = snapshot.targetRaceElevationGain

  if (
    !name
    || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || distanceKm === null
    || distanceKm === undefined
    || !Number.isFinite(distanceKm)
    || distanceKm <= 0
    || (
      elevationGain !== null
      && elevationGain !== undefined
      && (!Number.isInteger(elevationGain) || elevationGain < 0)
    )
  ) {
    return null
  }

  return {
    primaryCompetition: {
      id: `legacy-macrocycle:${snapshot.id}`,
      name,
      date,
      distanceKm,
      ...(elevationGain === null || elevationGain === undefined
        ? {}
        : { elevationGain }),
      priority: 'A',
    },
    intermediateCompetitions: [],
  }
}

/**
 * Resolves competitive planning context while keeping legacy compatibility
 * isolated from the periodization generator.
 *
 * Any persisted CompetitionEntry calendar has precedence, even when all of its
 * entries are lifecycle-inactive. The historical snapshot is consulted only
 * when no calendar rows exist. An incomplete legacy snapshot remains readable
 * but produces neutral context rather than fabricated competitive data.
 */
export function resolveCompetitionContext({
  competitionEntries,
  legacyMacrocycleSnapshot,
}: {
  competitionEntries: readonly CompetitionEntry[]
  legacyMacrocycleSnapshot?: LegacyTargetRaceSnapshot | null
}): ResolvedCompetitionContext {
  if (competitionEntries.length > 0) {
    const result = deriveCompetitionContext(competitionEntries)
    if (!result.valid) return result

    return {
      valid: true,
      context: result.context,
      source: 'competition_calendar',
    }
  }

  if (!legacyMacrocycleSnapshot) {
    return {
      valid: true,
      context: EMPTY_COMPETITION_CONTEXT,
      source: 'none',
    }
  }

  const legacyContext = adaptLegacyTargetRaceSnapshot(legacyMacrocycleSnapshot)
  if (legacyContext) {
    return {
      valid: true,
      context: legacyContext,
      source: 'legacy_snapshot',
    }
  }

  return {
    valid: true,
    context: EMPTY_COMPETITION_CONTEXT,
    source: hasLegacyTargetRaceSnapshot(legacyMacrocycleSnapshot)
      ? 'legacy_snapshot_incomplete'
      : 'none',
  }
}
