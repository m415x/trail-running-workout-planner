import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildAthleteTrainingResponseReview } from '@/lib/training-response/athlete-training-response-review'
import { projectTrainingResponseCompact, projectTrainingResponseDetail } from '@/lib/training-response/training-response-projections'
import type { AthleteAdherenceTrend, AthleteSystematicVolumeAssessment, InternalLoadSignal } from '@/types'

function runFlow(systematicVolume: AthleteSystematicVolumeAssessment, internalLoad: InternalLoadSignal, adherence: AthleteAdherenceTrend) {
  const review = buildAthleteTrainingResponseReview({ systematicVolume, internalLoad, adherence })
  return { review, compact: projectTrainingResponseCompact(review), detail: projectTrainingResponseDetail(review) }
}

describe('training response end-to-end flow', () => {
  it('preserves compatible independent evidence through triage and projections', async () => {
    const f = await import('./fixtures/training-response-e2e-fixtures')
    const result = runFlow(f.systematicExcess, f.elevatedInternalLoad, f.decliningAdherence)
    assert.equal(result.review.attention, 'priority')
    assert.equal(result.compact.status, 'priority')
    assert.ok(result.detail.reasons.includes('compatible_independent_evidence'))
    assert.deepEqual(result.detail.contributors.map(item => item.domain), ['systematic_volume', 'internal_load', 'adherence'])
  })

  it('preserves insufficient evidence as unknown', async () => {
    const f = await import('./fixtures/training-response-e2e-fixtures')
    const result = runFlow(f.insufficientVolume, f.insufficientInternalLoad, f.insufficientAdherence)
    assert.equal(result.review.attention, 'none')
    assert.equal(result.compact.status, 'unknown')
    assert.ok(result.detail.coverage.every(item => item.state === 'insufficient'))
  })

  it('does not elevate temporally incompatible evidence', async () => {
    const f = await import('./fixtures/training-response-e2e-fixtures')
    const result = runFlow(f.oldSystematicExcess, f.elevatedInternalLoad, f.stableAdherence)
    assert.equal(result.review.attention, 'review')
    assert.equal(result.detail.temporalCompatibility, 'not_compatible')
    assert.ok(result.detail.unknowns.includes('evidence_not_temporally_compatible'))
    assert.ok(!result.detail.reasons.includes('compatible_independent_evidence'))
  })

  it('keeps declining adherence as context only', async () => {
    const f = await import('./fixtures/training-response-e2e-fixtures')
    const result = runFlow(f.withinPlanVolume, f.stableInternalLoad, f.decliningAdherence)
    assert.equal(result.compact.status, 'none')
    assert.deepEqual(result.detail.contributors.map(item => [item.domain, item.role]), [['adherence', 'context']])
    assert.deepEqual(result.detail.reasons, ['declining_adherence_context'])
  })

  it('keeps operational output non-diagnostic and non-probabilistic', async () => {
    const f = await import('./fixtures/training-response-e2e-fixtures')
    const result = runFlow(f.systematicExcess, f.elevatedInternalLoad, f.decliningAdherence)
    assert.doesNotMatch(JSON.stringify(result), /diagnos|injury risk|overtrain|probability|likelihood/i)
  })
})
