import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildAthleteTrainingResponseReview } from '@/lib/training-response/athlete-training-response-review'
import { projectTrainingResponseCompact, projectTrainingResponseDetail } from '@/lib/training-response/training-response-projections'

describe('training response end-to-end flow', () => {
  it('projects an integrated review without changing its triage decision', () => {
    const review = buildAthleteTrainingResponseReview({
      systematicVolume: null,
      internalLoad: null,
      adherence: null,
    })
    const compact = projectTrainingResponseCompact(review)
    const detail = projectTrainingResponseDetail(review)

    assert.equal(compact.status, review.attention)
    assert.equal(detail.status, review.attention)
    assert.equal(detail.ruleVersion, review.convergenceRuleVersion)
  })
})
