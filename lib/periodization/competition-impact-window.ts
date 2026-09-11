import type {
  CompetitionImpactDateRange,
  CompetitionImpactOverlap,
  CompetitionImpactWindow,
  CompetitionImpactWindowInput,
  CompetitionImpactWindowResolution,
  CompetitionPriority,
} from '@/types'

const DAY_MS = 86_400_000
const PRIORITY_RANK: Record<CompetitionPriority, number> = { A: 3, B: 2, C: 1 }
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function parseIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new Error('competitionDate must use YYYY-MM-DD format.')
  }

  const [year, month, day] = value.split('-').map(Number)
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new Error('competitionDate must be a valid calendar date.')
  }

  return timestamp
}

function formatIsoDate(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10)
}

function addDays(date: string, days: number) {
  return formatIsoDate(parseIsoDate(date) + (days * DAY_MS))
}

function assertDuration(value: number, field: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer number of days.`)
  }
}

function buildRange(startDate: string, endDate: string): CompetitionImpactDateRange {
  const start = parseIsoDate(startDate)
  const end = parseIsoDate(endDate)

  if (end < start) throw new Error('Impact range endDate cannot precede startDate.')

  return {
    startDate,
    endDate,
    durationDays: Math.round((end - start) / DAY_MS) + 1,
  }
}

function rangesOverlap(
  first: CompetitionImpactDateRange | null,
  second: CompetitionImpactDateRange | null,
) {
  if (!first || !second) return false
  return first.startDate <= second.endDate && second.startDate <= first.endDate
}

function rangeContainsDate(range: CompetitionImpactDateRange | null, date: string) {
  return Boolean(range && range.startDate <= date && date <= range.endDate)
}

function overlapRange(first: CompetitionImpactWindow, second: CompetitionImpactWindow) {
  const startDate = first.startDate > second.startDate ? first.startDate : second.startDate
  const endDate = first.endDate < second.endDate ? first.endDate : second.endDate

  return startDate <= endDate ? { startDate, endDate } : null
}

function preRaceRange(window: CompetitionImpactWindow): CompetitionImpactDateRange {
  return buildRange(window.startDate, window.competitionDate)
}

function resolvePair(
  first: CompetitionImpactWindow,
  second: CompetitionImpactWindow,
): CompetitionImpactOverlap | null {
  const overlap = overlapRange(first, second)
  if (!overlap) return null

  const firstRaceDuringSecondRecovery = rangeContainsDate(second.post, first.competitionDate)
  const secondRaceDuringFirstRecovery = rangeContainsDate(first.post, second.competitionDate)

  if (firstRaceDuringSecondRecovery || secondRaceDuringFirstRecovery) {
    return {
      firstCompetitionId: first.competitionId,
      secondCompetitionId: second.competitionId,
      overlapStartDate: overlap.startDate,
      overlapEndDate: overlap.endDate,
      resolution: 'coach_review_required',
      dominantCompetitionId: null,
      requiresCoachReview: true,
      reasonCodes: [
        'recovery_overlap',
        'race_during_pending_recovery',
        'recovery_cannot_be_discarded',
      ],
    }
  }

  const recoveryOverlap = (
    rangesOverlap(first.post, preRaceRange(second))
    || rangesOverlap(second.post, preRaceRange(first))
    || rangesOverlap(first.post, second.post)
  )

  if (recoveryOverlap) {
    return {
      firstCompetitionId: first.competitionId,
      secondCompetitionId: second.competitionId,
      overlapStartDate: overlap.startDate,
      overlapEndDate: overlap.endDate,
      resolution: 'recovery_preserved',
      dominantCompetitionId: null,
      requiresCoachReview: false,
      reasonCodes: ['recovery_overlap', 'recovery_cannot_be_discarded'],
    }
  }

  if (rangesOverlap(preRaceRange(first), preRaceRange(second))) {
    const firstRank = PRIORITY_RANK[first.priority]
    const secondRank = PRIORITY_RANK[second.priority]

    if (firstRank === secondRank) {
      return {
        firstCompetitionId: first.competitionId,
        secondCompetitionId: second.competitionId,
        overlapStartDate: overlap.startDate,
        overlapEndDate: overlap.endDate,
        resolution: 'coach_review_required',
        dominantCompetitionId: null,
        requiresCoachReview: true,
        reasonCodes: ['pre_or_race_overlap', 'same_priority_overlap'],
      }
    }

    const dominantCompetitionId = firstRank > secondRank
      ? first.competitionId
      : second.competitionId

    return {
      firstCompetitionId: first.competitionId,
      secondCompetitionId: second.competitionId,
      overlapStartDate: overlap.startDate,
      overlapEndDate: overlap.endDate,
      resolution: 'higher_priority_precedence',
      dominantCompetitionId,
      requiresCoachReview: false,
      reasonCodes: ['pre_or_race_overlap', 'higher_priority_competition'],
    }
  }

  return {
    firstCompetitionId: first.competitionId,
    secondCompetitionId: second.competitionId,
    overlapStartDate: overlap.startDate,
    overlapEndDate: overlap.endDate,
    resolution: 'compatible',
    dominantCompetitionId: null,
    requiresCoachReview: false,
    reasonCodes: [],
  }
}

/** Builds the explicit pre/race/post calendar window for one competition. */
export function buildCompetitionImpactWindow(
  input: CompetitionImpactWindowInput,
): CompetitionImpactWindow {
  if (input.competitionId.trim().length === 0) {
    throw new Error('competitionId is required.')
  }

  parseIsoDate(input.competitionDate)
  assertDuration(input.taperDurationDays, 'taperDurationDays')
  assertDuration(input.recovery.totalRecoveryDays, 'recovery.totalRecoveryDays')

  if (input.recovery.priority !== input.priority) {
    throw new Error('Recovery decision priority must match competition priority.')
  }

  const pre = input.taperDurationDays > 0
    ? buildRange(
        addDays(input.competitionDate, -input.taperDurationDays),
        addDays(input.competitionDate, -1),
      )
    : null
  const race = buildRange(input.competitionDate, input.competitionDate)
  const post = input.recovery.totalRecoveryDays > 0
    ? buildRange(
        addDays(input.competitionDate, 1),
        addDays(input.competitionDate, input.recovery.totalRecoveryDays),
      )
    : null

  return {
    competitionId: input.competitionId,
    priority: input.priority,
    competitionDate: input.competitionDate,
    pre,
    race,
    post,
    startDate: pre?.startDate ?? input.competitionDate,
    endDate: post?.endDate ?? input.competitionDate,
    recovery: input.recovery,
  }
}

/**
 * Resolves overlapping competitive windows deterministically without mutating
 * planning. Higher-priority pre/race adjustments dominate lower priorities,
 * while physiological recovery is never discarded. A race scheduled inside a
 * still-active recovery window is surfaced for coach review.
 */
export function resolveCompetitionImpactWindows(
  windows: readonly CompetitionImpactWindow[],
): CompetitionImpactWindowResolution {
  const sorted = [...windows].sort((first, second) => (
    first.startDate.localeCompare(second.startDate)
    || first.competitionDate.localeCompare(second.competitionDate)
    || first.competitionId.localeCompare(second.competitionId)
  ))
  const overlaps: CompetitionImpactOverlap[] = []

  for (let firstIndex = 0; firstIndex < sorted.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < sorted.length; secondIndex += 1) {
      const first = sorted[firstIndex]
      const second = sorted[secondIndex]

      if (second.startDate > first.endDate) break

      const resolution = resolvePair(first, second)
      if (resolution) overlaps.push(resolution)
    }
  }

  return {
    windows: sorted,
    overlaps,
    requiresCoachReview: overlaps.some((overlap) => overlap.requiresCoachReview),
  }
}
