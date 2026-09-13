import type { ReadinessAssessment } from '@/types/training/readiness-assessment.types'
import type { ReadinessPolicy } from '@/types/training/readiness-policy.types'
import type { ReadinessCoachReview } from '@/types/training/readiness-review.types'

export interface PersistedReadinessEvaluation {
  readonly id: string
  readonly assessment: ReadinessAssessment
  readonly policySnapshot: ReadinessPolicy
  readonly createdAt: string
}

export interface ReadinessEvaluationPersistencePort<TTransaction> {
  transaction<TResult>(work: (tx: TTransaction) => TResult): TResult
  insertEvaluation(tx: TTransaction, evaluation: PersistedReadinessEvaluation): void
  findEvaluation(tx: TTransaction, evaluationId: string): PersistedReadinessEvaluation | null
  listReviews(tx: TTransaction, evaluationId: string): readonly ReadinessCoachReview[]
  appendReview(tx: TTransaction, review: ReadinessCoachReview): void
}
