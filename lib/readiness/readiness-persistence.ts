import type {
  PersistedReadinessEvaluation,
  ReadinessEvaluationPersistencePort,
} from '@/types/training/readiness-persistence.types'
import type { ReadinessAssessment } from '@/types/training/readiness-assessment.types'
import type { ReadinessPolicy } from '@/types/training/readiness-policy.types'
import type { ReadinessCoachReview } from '@/types/training/readiness-review.types'

export function persistReadinessEvaluation<TTransaction>(input: {
  readonly id: string
  readonly assessment: ReadinessAssessment
  readonly policy: ReadinessPolicy
  readonly persistence: ReadinessEvaluationPersistencePort<TTransaction>
}): PersistedReadinessEvaluation {
  if (input.id.trim().length === 0) throw new Error('Readiness evaluation id is required')
  if (input.assessment.policyVersion !== input.policy.version) {
    throw new Error('Readiness evaluation policy snapshot version mismatch')
  }
  if (input.assessment.teamId !== input.assessment.target.scope.teamId) {
    throw new Error('Readiness evaluation crosses team scope')
  }

  const evaluation: PersistedReadinessEvaluation = {
    id: input.id,
    assessment: input.assessment,
    policySnapshot: input.policy,
    createdAt: input.assessment.evaluatedAt,
  }

  return input.persistence.transaction((tx) => {
    const existing = input.persistence.findEvaluation(tx, input.id)
    if (existing) return existing
    input.persistence.insertEvaluation(tx, evaluation)
    return evaluation
  })
}

export function persistReadinessCoachReview<TTransaction>(input: {
  readonly review: ReadinessCoachReview
  readonly persistence: ReadinessEvaluationPersistencePort<TTransaction>
}): ReadinessCoachReview {
  return input.persistence.transaction((tx) => {
    const evaluation = input.persistence.findEvaluation(tx, input.review.assessmentId)
    if (!evaluation) throw new Error('Readiness evaluation not found')
    if (
      evaluation.assessment.teamId !== input.review.teamId
      || evaluation.assessment.athleteId !== input.review.athleteId
    ) {
      throw new Error('Readiness review crosses evaluation scope')
    }
    input.persistence.appendReview(tx, input.review)
    return input.review
  })
}
