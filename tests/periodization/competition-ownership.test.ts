import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateCompetitionOwnership } from '@/lib/periodization/competition-ownership'

describe('competition ownership policy', () => {
  it('allows a cohort variant to own a competition for its entire cohort audience', () => {
    assert.deepEqual(
      validateCompetitionOwnership({
        planKind: 'cohort_variant',
        coversEntirePlanAudience: true,
      }),
      { valid: true, ownerKind: 'cohort_variant' },
    )
  })

  it('allows a base plan to own a competition only when it applies to the whole group', () => {
    assert.deepEqual(
      validateCompetitionOwnership({
        planKind: 'group_base',
        coversEntirePlanAudience: true,
      }),
      { valid: true, ownerKind: 'group_base' },
    )
  })

  it('rejects attaching a partial-audience competition directly to a base plan', () => {
    assert.deepEqual(
      validateCompetitionOwnership({
        planKind: 'group_base',
        coversEntirePlanAudience: false,
      }),
      {
        valid: false,
        errors: ['competition_owner_partial_audience_not_allowed'],
      },
    )
  })

  it('rejects a partial competition audience for any plan owner', () => {
    assert.deepEqual(
      validateCompetitionOwnership({
        planKind: 'cohort_variant',
        coversEntirePlanAudience: false,
      }),
      {
        valid: false,
        errors: ['competition_owner_partial_audience_not_allowed'],
      },
    )
  })
})
