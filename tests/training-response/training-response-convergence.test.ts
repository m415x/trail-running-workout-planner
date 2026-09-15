import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { composeTrainingResponseReview } from '@/lib/training-response/training-response-convergence'
import type { TrainingResponseContributor } from '@/types'

const window = { startDate: '2026-08-01', endDate: '2026-08-07' } as const

function contributor(
  domain: TrainingResponseContributor['domain'],
  signal: string,
  role: TrainingResponseContributor['role'] = 'evidence',
  evidenceWindow: TrainingResponseContributor['evidenceWindow'] = window,
): TrainingResponseContributor {
  return {
    domain,
    signal,
    role,
    evidenceWindow,
    sourceRuleVersion: `${domain}-v1`,
  }
}

describe('training response convergence v1', () => {
  it('prioritizes compatible systematic excess and recent internal load above baseline', () => {
    const result = composeTrainingResponseReview({
      contributors: [
        contributor('systematic_volume', 'systematic_excess'),
        contributor('internal_load', 'recent_load_above_baseline'),
      ],
      limitations: [],
    })

    assert.equal(result.attention, 'priority')
    assert.equal(result.temporalCompatibility, 'compatible')
    assert.equal(result.convergenceRuleVersion, 'training-response-convergence-v1')
    assert.deepEqual(result.reasons, [
      'systematic_volume_excess',
      'recent_internal_load_above_baseline',
      'compatible_independent_evidence',
    ])
  })

  it('keeps systematic excess at review when internal load is insufficient', () => {
    const result = composeTrainingResponseReview({
      contributors: [contributor('systematic_volume', 'systematic_excess')],
      limitations: ['internal_load_insufficient_data'],
    })

    assert.equal(result.attention, 'review')
    assert.deepEqual(result.reasons, ['systematic_volume_excess'])
    assert.deepEqual(result.limitations, ['internal_load_insufficient_data'])
  })

  it('keeps recent internal load above baseline at info when volume is insufficient', () => {
    const result = composeTrainingResponseReview({
      contributors: [contributor('internal_load', 'recent_load_above_baseline')],
      limitations: ['systematic_volume_insufficient_data'],
    })

    assert.equal(result.attention, 'info')
    assert.deepEqual(result.reasons, ['recent_internal_load_above_baseline'])
  })

  it('explains isolated systematic excess as informational evidence', () => {
    const result = composeTrainingResponseReview({
      contributors: [contributor('systematic_volume', 'isolated_excess')],
      limitations: [],
    })

    assert.equal(result.attention, 'info')
    assert.deepEqual(result.reasons, ['isolated_systematic_volume_excess'])
  })

  it('does not prioritize evidence from disjoint periods', () => {
    const result = composeTrainingResponseReview({
      contributors: [
        contributor(
          'systematic_volume',
          'systematic_excess',
          'evidence',
          { startDate: '2026-07-01', endDate: '2026-07-07' },
        ),
        contributor(
          'internal_load',
          'recent_load_above_baseline',
          'evidence',
          { startDate: '2026-08-01', endDate: '2026-08-07' },
        ),
      ],
      limitations: [],
    })

    assert.equal(result.attention, 'review')
    assert.equal(result.temporalCompatibility, 'not_compatible')
    assert.deepEqual(result.reasons, [
      'systematic_volume_excess',
      'recent_internal_load_above_baseline',
    ])
    assert.ok(result.limitations.includes('evidence_not_temporally_compatible'))
  })

  it('does not prioritize when temporal compatibility is indeterminate', () => {
    const result = composeTrainingResponseReview({
      contributors: [
        contributor('systematic_volume', 'systematic_excess'),
        contributor('internal_load', 'recent_load_above_baseline', 'evidence', null),
      ],
      limitations: [],
    })

    assert.equal(result.attention, 'review')
    assert.equal(result.temporalCompatibility, 'indeterminate')
    assert.deepEqual(result.reasons, [
      'systematic_volume_excess',
      'recent_internal_load_above_baseline',
    ])
    assert.ok(result.limitations.includes('temporal_compatibility_indeterminate'))
  })

  it('keeps declining adherence contextual and unable to establish priority', () => {
    const result = composeTrainingResponseReview({
      contributors: [contributor('adherence', 'declining', 'context')],
      limitations: [],
    })

    assert.equal(result.attention, 'none')
    assert.deepEqual(result.reasons, ['declining_adherence_context'])
    assert.equal(result.contributors[0]?.role, 'context')
  })

  it('returns no reason when no contributor establishes review context', () => {
    const result = composeTrainingResponseReview({ contributors: [], limitations: [] })

    assert.equal(result.attention, 'none')
    assert.deepEqual(result.reasons, [])
  })

  it('does not treat multiple systematic-volume contributors as independent domains', () => {
    const result = composeTrainingResponseReview({
      contributors: [
        contributor('systematic_volume', 'systematic_excess'),
        contributor('systematic_volume', 'systematic_excess'),
      ],
      limitations: [],
    })

    assert.equal(result.attention, 'review')
    assert.notEqual(result.attention, 'priority')
  })

  it('orders contributors deterministically by domain', () => {
    const result = composeTrainingResponseReview({
      contributors: [
        contributor('adherence', 'declining', 'context'),
        contributor('internal_load', 'recent_load_above_baseline'),
        contributor('systematic_volume', 'isolated_excess'),
      ],
      limitations: [],
    })

    assert.deepEqual(
      result.contributors.map(({ domain }) => domain),
      ['systematic_volume', 'internal_load', 'adherence'],
    )
    assert.deepEqual(result.reasons, [
      'isolated_systematic_volume_excess',
      'recent_internal_load_above_baseline',
      'declining_adherence_context',
    ])
  })
})
