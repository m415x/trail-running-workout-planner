import type { AthleteIntegralPlanningResolution } from '@/lib/planning-cohorts/integral-planning-resolution'
import { deriveCompetitionContext } from '@/lib/periodization/competition-context'
import { assessCompetitionDemand } from '@/lib/periodization/competition-demand-assessment'
import type { CompetitionEntry } from '@/types/training/competition-entry.types'
import type {
  ReadinessCompetitionTarget,
  ReadinessCompetitionTargetResolution,
} from '@/types/training/readiness-competition.types'

function buildTarget(
  resolution: Extract<AthleteIntegralPlanningResolution, { status: 'resolved' }>,
  entry: CompetitionEntry,
): ReadinessCompetitionTarget {
  const reviewedCompetition = resolution.review.competitions.find(({ entry: candidate }) => candidate.id === entry.id)

  return {
    scope: resolution.review.scope,
    competitionEntryId: entry.id,
    name: entry.name,
    date: entry.date,
    distanceKm: entry.distanceKm,
    elevationGainM: entry.elevationGainM ?? null,
    priority: entry.priority,
    demand: assessCompetitionDemand({
      distanceKm: entry.distanceKm,
      elevationGainM: entry.elevationGainM ?? null,
      source: 'derived',
    }),
    impactWindow: reviewedCompetition?.impactWindow ?? null,
  }
}

/**
 * Resolves the race used by H12 only from the already-resolved H11 athlete
 * planning aggregate. It never invents an athlete race registration.
 */
export function resolveReadinessCompetitionTarget(input: {
  readonly planningResolution: AthleteIntegralPlanningResolution
  readonly selectedCompetitionEntryId?: string | null
}): ReadinessCompetitionTargetResolution {
  const resolution = input.planningResolution
  if (resolution.status !== 'resolved') {
    return { status: 'unavailable', reason: 'athlete_planning_not_resolved' }
  }

  const entries = resolution.review.competitions.map(({ entry }) => entry)
  const contextResult = deriveCompetitionContext(entries)
  if (!contextResult.valid) {
    return { status: 'unavailable', reason: 'competition_context_invalid' }
  }

  const context = contextResult.context
  const applicableIds = new Set([
    ...(context.primaryCompetition ? [context.primaryCompetition.id] : []),
    ...context.intermediateCompetitions.map(({ id }) => id),
  ])
  const applicableEntries = entries.filter(({ id }) => applicableIds.has(id))

  if (input.selectedCompetitionEntryId) {
    const selected = applicableEntries.find(({ id }) => id === input.selectedCompetitionEntryId)
    if (!selected) {
      return { status: 'unavailable', reason: 'selected_competition_not_applicable' }
    }
    return {
      status: 'resolved',
      source: 'explicit_selection',
      target: buildTarget(resolution, selected),
    }
  }

  if (context.primaryCompetition) {
    const primary = applicableEntries.find(({ id }) => id === context.primaryCompetition?.id)
    if (primary) {
      return {
        status: 'resolved',
        source: 'primary_competition',
        target: buildTarget(resolution, primary),
      }
    }
  }

  if (applicableEntries.length === 0) {
    return { status: 'unavailable', reason: 'no_applicable_competition' }
  }

  return {
    status: 'selection_required',
    applicableCompetitions: applicableEntries,
  }
}
