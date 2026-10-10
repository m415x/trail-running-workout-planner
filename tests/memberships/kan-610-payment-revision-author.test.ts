import assert from 'node:assert/strict'
import test from 'node:test'
import { applyPaymentRevision } from '../../lib/memberships/billing'

test('KAN-731 payment append-only revisions retain trusted H2 author for register, correction and void', () => {
  const base = {
    paymentId: 'payment-a',
    monthlyChargeId: 'charge-a',
    amountMinor: 2000,
    paymentMethod: 'cash' as const,
    paidAt: '2026-10-10',
  }
  const registered = applyPaymentRevision({
    revisions: [], revisionId: 'rev-1', ...base, voided: false,
    createdByUserId: 'coach-a',
  })
  assert.equal(registered[0].createdByUserId, 'coach-a')

  const corrected = applyPaymentRevision({
    revisions: registered, revisionId: 'rev-2', ...base,
    amountMinor: 2500, voided: false, createdByUserId: 'coach-b',
  })
  assert.equal(corrected[0].createdByUserId, 'coach-a')
  assert.equal(corrected[1].createdByUserId, 'coach-b')
  assert.equal(corrected[0].isCurrent, false)

  const voided = applyPaymentRevision({
    revisions: corrected, revisionId: 'rev-3', ...base,
    amountMinor: 2500, voided: true, createdByUserId: 'coach-c',
  })
  assert.deepEqual(voided.map(row => row.createdByUserId), ['coach-a', 'coach-b', 'coach-c'])
  assert.deepEqual(voided.map(row => row.isCurrent), [false, false, true])
  assert.equal(voided[2].voided, true)
})
