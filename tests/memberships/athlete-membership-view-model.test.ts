import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAthleteMembershipViewModel } from '../../lib/memberships/athlete-membership-view-model'

test('builds ES athlete membership presentation from terms and materialized charges only', () => {
  const model = buildAthleteMembershipViewModel({
    locale: 'es',
    terms: [{
      id: 'terms-1',
      athleteId: 'athlete-1',
      monthlyAmountMinor: 2_500_000,
      currency: 'ARS',
      effectiveFrom: '2026-09-15',
      effectiveUntil: null,
    }],
    charges: [{
      athleteId: 'athlete-1',
      billingTermsId: 'terms-1',
      year: 2026,
      month: 9,
      baseAmountMinor: 2_500_000,
      amountDueMinor: 2_500_000,
      currency: 'ARS',
      baseDueDate: '2026-09-15',
      effectiveDueDate: '2026-09-15',
    }],
  })

  assert.equal(model.title, 'Membresía')
  assert.equal(model.currentTerms?.monthlyAmount, '$25.000')
  assert.equal(model.currentTerms?.effectiveFrom, '2026-09-15')
  assert.equal(model.charges[0]?.period, '09/2026')
  assert.equal(model.charges[0]?.amountDue, '$25.000')
  assert.equal(model.charges[0]?.effectiveDueDate, '2026-09-15')
})

test('builds EN empty state without H2+ payment or debt semantics', () => {
  const model = buildAthleteMembershipViewModel({
    locale: 'en',
    terms: [],
    charges: [],
  })

  assert.equal(model.title, 'Membership')
  assert.equal(model.currentTerms, null)
  assert.equal(model.emptyTerms, 'No economic terms have been configured for this athlete yet.')
  assert.equal(model.emptyCharges, 'No monthly charges have been materialized yet.')
  assert.doesNotMatch(JSON.stringify(model), /paid|pending|overdue|balance|debt|scholarship|extension/i)
})
