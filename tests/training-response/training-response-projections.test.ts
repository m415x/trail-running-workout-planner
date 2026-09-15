import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { projectTrainingResponseCompact, projectTrainingResponseDetail } from '@/lib/training-response/training-response-projections'
import type { TrainingResponseReview } from '@/types'

const priorityReview: TrainingResponseReview = {
  attention: 'priority',
  contributors: [
    { domain: 'systematic_volume', signal: 'systematic_excess', role: 'evidence', evidenceWindow: { startDate: '2026-08-01', endDate: '2026-08-07' }, sourceRuleVersion: 'systematic-volume-v1' },
    { domain: 'internal_load', signal: 'recent_load_above_baseline', role: 'evidence', evidenceWindow: { startDate: '2026-08-01', endDate: '2026-08-07' }, sourceRuleVersion: 'internal-load-signal-v1' },
  ],
  reasons: ['systematic_volume_excess', 'recent_internal_load_above_baseline', 'compatible_independent_evidence'],
  limitations: [],
  temporalCompatibility: 'compatible',
  convergenceRuleVersion: 'training-response-convergence-v1',
}

describe('training response coach projections', () => {
  it('projects a minimal compact result', () => {
    assert.deepEqual(projectTrainingResponseCompact(priorityReview), {
      status: 'priority',
      primaryReason: 'systematic_volume_excess',
      hasLimitations: false,
      ruleVersion: 'training-response-convergence-v1',
    })
  })

  it('uses unknown only when no meaningful known result is available', () => {
    const result = projectTrainingResponseCompact({ ...priorityReview, attention: 'none', contributors: [], reasons: [], limitations: ['internal_load_insufficient_data'], temporalCompatibility: null })
    assert.equal(result.status, 'unknown')
    assert.equal(result.primaryReason, null)
    assert.equal(result.hasLimitations, true)
  })

  it('keeps known context distinct from unknown', () => {
    const result = projectTrainingResponseCompact({ ...priorityReview, attention: 'none', contributors: [{ domain: 'adherence', signal: 'declining', role: 'context', evidenceWindow: null, sourceRuleVersion: 'plan-adherence-v1' }], reasons: ['declining_adherence_context'], limitations: ['internal_load_insufficient_data'], temporalCompatibility: null })
    assert.equal(result.status, 'none')
    assert.equal(result.primaryReason, 'declining_adherence_context')
  })

  it('projects traceable detail and limitations as unknowns', () => {
    const result = projectTrainingResponseDetail({ ...priorityReview, limitations: ['adherence_insufficient_data'] })
    assert.equal(result.status, 'priority')
    assert.deepEqual(result.reasons, priorityReview.reasons)
    assert.deepEqual(result.unknowns, ['adherence_insufficient_data'])
    assert.deepEqual(result.contributors.map(item => item.domain), ['systematic_volume', 'internal_load'])
    assert.equal(result.temporalCompatibility, 'compatible')
    assert.equal(result.ruleVersion, 'training-response-convergence-v1')
  })
})
