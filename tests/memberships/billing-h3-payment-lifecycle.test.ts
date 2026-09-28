import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createBillingPersistenceAdapter,
  type PersistedMonthlyCharge,
  type PersistedPaymentRevision,
} from '@/lib/memberships/billing-persistence'

const charge: PersistedMonthlyCharge = {
  id: 'charge-1',
  athleteId: 'athlete-1',
  billingTermsId: 'terms-1',
  year: 2026,
  month: 10,
  baseAmountMinor: 2_500_000,
  amountDueMinor: 2_000_000,
  currency: 'ARS',
  baseDueDate: '2026-10-05',
  effectiveDueDate: '2026-10-05',
}

const original: PersistedPaymentRevision = {
  revisionId: 'payment-revision-1',
  paymentId: 'payment-1',
  monthlyChargeId: 'charge-1',
  amountMinor: 750_000,
  paymentMethod: 'cash',
  paidAt: '2026-10-03',
  voided: false,
  isCurrent: true,
}

function createPort(overrides: Record<string, unknown> = {}) {
  const paymentRevisions: PersistedPaymentRevision[] = [original]
  const replacements: PersistedPaymentRevision[] = []

  return {
    paymentRevisions,
    replacements,
    athleteBelongsToTeam: async (teamId: string, athleteId: string) =>
      teamId === 'team-1' && athleteId === 'athlete-1',
    listBillingTerms: async () => [],
    listMonthlyCharges: async () => [charge],
    listPersistedMonthlyCharges: async () => [charge],
    listTeamEconomicPolicies: async () => [],
    insertMonthlyCharges: async () => {},
    listPaymentRevisions: async (monthlyChargeId: string) =>
      paymentRevisions.filter(revision => revision.monthlyChargeId === monthlyChargeId),
    insertPaymentRevision: async (revision: PersistedPaymentRevision) => {
      paymentRevisions.push(revision)
    },
    replaceCurrentPaymentRevisionAtomically: async (
      previous: PersistedPaymentRevision,
      replacement: PersistedPaymentRevision,
    ) => {
      const index = paymentRevisions.findIndex(revision => revision.revisionId === previous.revisionId)
      paymentRevisions[index] = { ...previous, isCurrent: false }
      paymentRevisions.push(replacement)
      replacements.push(replacement)
    },
    listMonthlyChargeReductionRevisions: async () => [],
    applyMonthlyChargeReductionAtomically: async () => {},
    ...overrides,
  }
}

test('correcting a Payment appends one current revision and preserves the logical Payment identity', async () => {
  const port = createPort()
  const adapter = createBillingPersistenceAdapter(port as never)

  const corrected = await adapter.correctManualPayment({
    teamId: 'team-1',
    athleteId: 'athlete-1',
    monthlyChargeId: 'charge-1',
    paymentId: 'payment-1',
    revisionId: 'payment-revision-2',
    amountMinor: 1_000_000,
    paymentMethod: 'bank_transfer',
    paidAt: '2026-10-04',
  })

  assert.equal(port.paymentRevisions.length, 2)
  assert.equal(port.paymentRevisions[0]?.isCurrent, false)
  assert.equal(corrected.isCurrent, true)
  assert.equal(corrected.paymentId, original.paymentId)
  assert.equal(corrected.monthlyChargeId, original.monthlyChargeId)
  assert.equal(corrected.amountMinor, 1_000_000)
  assert.equal(corrected.paymentMethod, 'bank_transfer')
  assert.equal(corrected.paidAt, '2026-10-04')
  assert.equal(corrected.voided, false)
})

test('voiding a Payment appends an explicit current void revision and removes it from effective paid amount', async () => {
  const port = createPort()
  const adapter = createBillingPersistenceAdapter(port as never)

  const voided = await adapter.voidManualPayment({
    teamId: 'team-1',
    athleteId: 'athlete-1',
    monthlyChargeId: 'charge-1',
    paymentId: 'payment-1',
    revisionId: 'payment-revision-void',
  })

  assert.equal(port.paymentRevisions.length, 2)
  assert.equal(port.paymentRevisions[0]?.isCurrent, false)
  assert.equal(voided.isCurrent, true)
  assert.equal(voided.voided, true)
  assert.equal(voided.amountMinor, original.amountMinor)
  assert.equal(voided.paymentMethod, original.paymentMethod)
  assert.equal(voided.paidAt, original.paidAt)
})

test('payment correction cannot make effective payments exceed the H2-effective amount due', async () => {
  const otherPayment: PersistedPaymentRevision = {
    revisionId: 'payment-2-revision-1',
    paymentId: 'payment-2',
    monthlyChargeId: 'charge-1',
    amountMinor: 1_250_000,
    paymentMethod: 'bank_transfer',
    paidAt: '2026-10-02',
    voided: false,
    isCurrent: true,
  }
  const port = createPort({
    listPaymentRevisions: async () => [original, otherPayment],
  })
  const adapter = createBillingPersistenceAdapter(port as never)

  await assert.rejects(
    () => adapter.correctManualPayment({
      teamId: 'team-1',
      athleteId: 'athlete-1',
      monthlyChargeId: 'charge-1',
      paymentId: 'payment-1',
      revisionId: 'payment-revision-overpay',
      amountMinor: 1_000_000,
      paymentMethod: 'cash',
      paidAt: '2026-10-03',
    }),
    /amount due|overpay|exceed/i,
  )
})

test('H2 reduction is rejected when it would lower amount due below effective H3 payments', async () => {
  let reductionApplied = false
  const port = createPort({
    listPaymentRevisions: async () => [original],
    applyMonthlyChargeReductionAtomically: async () => {
      reductionApplied = true
    },
  })
  const adapter = createBillingPersistenceAdapter(port as never)

  await assert.rejects(
    () => adapter.applyMonthlyChargeReduction({
      teamId: 'team-1',
      monthlyChargeId: 'charge-1',
      revision: {
        id: 'reduction-1',
        athleteId: 'athlete-1',
        year: 2026,
        month: 10,
        reductionAmountMinor: 1_800_000,
        reason: 'Beca parcial',
        isCurrent: true,
      },
    }),
    /payment|paid|amount due|overpay|exceed/i,
  )

  assert.equal(reductionApplied, false)
})
