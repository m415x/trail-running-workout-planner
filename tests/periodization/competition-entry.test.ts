import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateCompetitionEntryDraft } from '@/lib/periodization/competition-entry'

import type { CompetitionEntryDraft, CompetitionStatus } from '@/types'

const validDraft: CompetitionEntryDraft = {
  groupTrainingPlanId: 'plan-1',
  name: 'Patagonia Run 42K',
  date: '2027-04-10',
  distanceKm: 42,
  elevationGainM: 2500,
  priority: 'A',
  status: 'planned',
  description: null,
}

describe('competition entry domain validation', () => {
  it('accepts a concrete competition modality with a positive distance', () => {
    assert.deepEqual(validateCompetitionEntryDraft(validDraft), { valid: true })
  })

  it('accepts every lifecycle status defined by the competition domain', () => {
    const statuses: CompetitionStatus[] = ['planned', 'confirmed', 'completed', 'cancelled']

    for (const status of statuses) {
      assert.deepEqual(validateCompetitionEntryDraft({ ...validDraft, status }), { valid: true })
    }
  })

  it('rejects zero, negative and non-finite competition distances', () => {
    for (const distanceKm of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = validateCompetitionEntryDraft({ ...validDraft, distanceKm })

      assert.equal(result.valid, false)
      if (!result.valid) {
        assert.ok(result.errors.includes('competition_entry_distance_invalid'))
      }
    }
  })

  it('allows missing or zero elevation gain but rejects negative or non-finite values', () => {
    assert.deepEqual(
      validateCompetitionEntryDraft({ ...validDraft, elevationGainM: undefined }),
      { valid: true },
    )
    assert.deepEqual(validateCompetitionEntryDraft({ ...validDraft, elevationGainM: 0 }), {
      valid: true,
    })

    for (const elevationGainM of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = validateCompetitionEntryDraft({ ...validDraft, elevationGainM })

      assert.equal(result.valid, false)
      if (!result.valid) {
        assert.ok(result.errors.includes('competition_entry_elevation_gain_invalid'))
      }
    }
  })

  it('requires a real YYYY-MM-DD calendar date', () => {
    for (const date of ['2027-02-29', '2027-13-01', '10/04/2027', '']) {
      const result = validateCompetitionEntryDraft({ ...validDraft, date })

      assert.equal(result.valid, false)
      if (!result.valid) {
        assert.ok(result.errors.includes('competition_entry_date_invalid'))
      }
    }

    assert.deepEqual(validateCompetitionEntryDraft({ ...validDraft, date: '2028-02-29' }), {
      valid: true,
    })
  })

  it('requires plan ownership and a non-empty competition name', () => {
    const result = validateCompetitionEntryDraft({
      ...validDraft,
      groupTrainingPlanId: '   ',
      name: '',
    })

    assert.equal(result.valid, false)
    if (!result.valid) {
      assert.ok(result.errors.includes('competition_entry_group_training_plan_required'))
      assert.ok(result.errors.includes('competition_entry_name_required'))
    }
  })

  it('uses locale-neutral validation error codes', () => {
    const result = validateCompetitionEntryDraft({ ...validDraft, distanceKm: 0 })

    assert.equal(result.valid, false)
    if (!result.valid) {
      assert.deepEqual(result.errors, ['competition_entry_distance_invalid'])
    }
  })
})
