import type { ReadinessPolicy } from '@/types/training/readiness-policy.types'
import type {
  ReadinessCompetitionTarget,
  ReadinessEvaluationPhase,
  ReadinessEvaluationPhaseResolution,
} from '@/types/training/readiness-competition.types'

const DAY_MS = 86_400_000

function parseDate(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error(`Invalid ISO date: ${value}`)
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid ISO date: ${value}`)
  }
  return timestamp
}

function inclusive(date: string, startDate: string, endDate: string): boolean {
  return date >= startDate && date <= endDate
}

function recoveryPhaseForDate(
  evaluationDate: string,
  target: ReadinessCompetitionTarget,
): ReadinessEvaluationPhase {
  const window = target.impactWindow
  if (!window?.post) return 'post_competition_unknown'

  const offset = Math.floor((parseDate(evaluationDate) - parseDate(window.post.startDate)) / DAY_MS)
  let cursor = 0
  for (const phase of window.recovery.phases) {
    const endExclusive = cursor + phase.durationDays
    if (offset >= cursor && offset < endExclusive) {
      if (phase.phase === 'acute_recovery') return 'acute_recovery'
      if (phase.phase === 'recovery') return 'recovery'
      return 'reentry'
    }
    cursor = endExclusive
  }
  return 'post_recovery'
}

export function resolveReadinessEvaluationPhase(input: {
  readonly evaluationDate: string
  readonly target: ReadinessCompetitionTarget
}): ReadinessEvaluationPhaseResolution {
  const evaluation = parseDate(input.evaluationDate)
  const competition = parseDate(input.target.date)
  const daysUntilCompetition = Math.round((competition - evaluation) / DAY_MS)
  const window = input.target.impactWindow

  let phase: ReadinessEvaluationPhase
  if (input.evaluationDate === input.target.date) {
    phase = 'competition'
  } else if (input.evaluationDate < input.target.date) {
    phase = window?.pre && inclusive(input.evaluationDate, window.pre.startDate, window.pre.endDate)
      ? 'taper'
      : 'preparation'
  } else if (!window?.post) {
    phase = 'post_competition_unknown'
  } else if (inclusive(input.evaluationDate, window.post.startDate, window.post.endDate)) {
    phase = recoveryPhaseForDate(input.evaluationDate, input.target)
  } else {
    phase = 'post_recovery'
  }

  return {
    evaluationDate: input.evaluationDate,
    competitionDate: input.target.date,
    phase,
    daysUntilCompetition,
  }
}

export function suppressExpectedReducedLoadAlert(input: {
  readonly phase: ReadinessEvaluationPhase
  readonly policy: ReadinessPolicy
}): boolean {
  if (input.phase === 'taper') return input.policy.suppressExpectedTaperReductionAlerts
  if (
    input.phase === 'acute_recovery'
    || input.phase === 'recovery'
    || input.phase === 'reentry'
  ) {
    return input.policy.suppressExpectedRecoveryReductionAlerts
  }
  return false
}
