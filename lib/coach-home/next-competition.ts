import type { CompetitionEntry } from '@/types/training/competition-entry.types'

type Unavailable = 'denied' | 'selection_required' | 'invalid_context' | 'error'
type CompetitionCandidate = Pick<
  CompetitionEntry, 'id' | 'groupTrainingPlanId' | 'name' | 'date' | 'status' | 'priority' | 'distanceKm' | 'isDeleted'
>

export type CoachHomeNextCompetitionResult<T extends CompetitionCandidate = CompetitionCandidate> =
  | { status: Unavailable | 'empty' }
  | { status: 'ready'; competition: T }

/**
 * Presentation-only projection. Authorized Plan IDs must originate from an H2/H3/H4A
 * server-side reader, never from client input. The database adapter also applies
 * the IDs, date and status in SQL before materializing a bounded result.
 */
export function selectCoachHomeNextCompetition<T extends CompetitionCandidate>(input: {
  planning: { status: Unavailable | 'empty' } | { status: 'ready'; authorizedPlanIds: readonly string[] }
  calendar: { status: Unavailable } | { status: 'ready'; entries: readonly T[] }
  today: string
}): CoachHomeNextCompetitionResult<T> {
  if (input.planning.status !== 'ready') return { status: input.planning.status }
  if (input.planning.authorizedPlanIds.length === 0) return { status: 'empty' }
  if (input.calendar.status !== 'ready') return { status: input.calendar.status }

  const authorized = new Set(input.planning.authorizedPlanIds)
  const upcoming = input.calendar.entries
    .filter((entry) =>
      authorized.has(entry.groupTrainingPlanId)
      && !entry.isDeleted
      && entry.date >= input.today
      && (entry.status === 'planned' || entry.status === 'confirmed'),
    )
    .sort((a, b) =>
      a.date.localeCompare(b.date)
      || a.id.localeCompare(b.id),
    )
  const competition = upcoming[0]
  return competition ? { status: 'ready', competition } : { status: 'empty' }
}
