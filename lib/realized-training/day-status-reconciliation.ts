import type { DayStatus } from '@/types'

export type PlannedSessionEvidenceOutcome = 'completed' | 'partial' | null

export interface ReconcileTrainingDayStatusInput {
  /** Calendar day of the planned session in YYYY-MM-DD form. */
  readonly date: string
  /** Current local calendar day in the same YYYY-MM-DD form. */
  readonly today: string
  readonly hasPlannedSession: boolean
  /**
   * Current compliance result derived from durable realized-training evidence.
   * A late manual capture or import may therefore replace a previous `missed`
   * result with `completed` or `partial`.
   */
  readonly matchedEvidenceOutcome: PlannedSessionEvidenceOutcome
}

/**
 * Reconciles the current status of one calendar day from the evidence available
 * now. `missed` is deliberately not terminal: it means that a planned session is
 * in the past and no matched realized evidence is currently available.
 *
 * This function does not decide whether realized metrics satisfy a prescription;
 * that comparison belongs to the plan-vs-realized domain. It only consumes that
 * evaluator's `completed`/`partial` outcome when one exists.
 */
export function reconcileTrainingDayStatus(input: ReconcileTrainingDayStatusInput): DayStatus {
  if (!input.hasPlannedSession) return 'rest'
  if (input.matchedEvidenceOutcome) return input.matchedEvidenceOutcome
  if (input.date < input.today) return 'missed'
  return 'pending'
}

export interface RealizedTrainingDayIdentity {
  readonly date: string
  readonly sessionId: string | null
}

/**
 * Returns whether a calendar day contains durable realized training that is not
 * linked to an official planned session. These records still contribute to the
 * athlete's realized load/readiness; they are not silently attached to a plan.
 */
export function hasUnplannedTrainingOnDate(
  records: readonly RealizedTrainingDayIdentity[],
  date: string,
): boolean {
  return records.some(record => record.date === date && record.sessionId === null)
}
