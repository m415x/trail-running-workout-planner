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

function createPort(overrides: Partial<Record<string, unknown>> = {}) {
  const paymentRevisions: PersistedPaymentRevision[] = []

  return {
    athleteBelongsToTeam: async (teamId: string, athleteId: string) =>
      teamId === 'team-1' && athleteId === 'athlete-1',
    listBillingTerms: async () => [],
    listMonthlyCharges: async (_teamId: string, athleteId: string) =>
      athleteId === 'athlete-1' ? [charge] : [],
    listPersistedMonthlyCharges: async () => [charge],
    listTeamEconomicPolicies: async () => [],
    insertMonthlyCharges: async () => {},
    listPaymentRevisions: async (monthlyChargeId: string) =>
      paymentRevisions.filter(revision => revision.monthlyChargeId === monthlyChargeId),
    insertPaymentRevision: async (revision: PersistedPaymentRevision) => {
      paymentRevisions.push(revision)
    },
    ...overrides,
  }
}

test('manual payment registration persists one current Payment revision for the requested charge', async () => {
  const port = createPort()
  const adapter = createBillingPersistenceAdapter(port as never)

  const result = await adapter.registerManualPayment({
    teamId: 'team-1',
    athleteId: 'athlete-1',
    monthlyChargeId: 'charge-1',
    revisionId: 'payment-revision-1',
    paymentId: 'payment-1',
    amountMinor: 750_000,
    paymentMethod: 'bank_transfer',
    paidAt: '2026-10-03',
  })

  assert.equal(result.paymentId, 'payment-1')
  assert.equal(result.monthlyChargeId, 'charge-1')
  assert.equal(result.amountMinor, 750_000)
  assert.equal(result.paymentMethod, 'bank_transfer')
  assert.equal(result.paidAt, '2026-10-03')
  assert.equal(result.voided, false)
  assert.equal(result.isCurrent, true)
})

test('manual payment registration rejects athlete/team/charge scope mismatches', async () => {
  const adapter = createBillingPersistenceAdapter(createPort() as never)

  await assert.rejects(
    () => adapter.registerManualPayment({
      teamId: 'team-1',
      athleteId: 'athlete-2',
      monthlyChargeId: 'charge-1',
      revisionId: 'payment-revision-1',
      paymentId: 'payment-1',
      amountMinor: 500_000,
      paymentMethod: 'cash',
      paidAt: '2026-10-03',
    }),
    /team|athlete|scope|charge/i,
  )

  await assert.rejects(
    () => adapter.registerManualPayment({
      teamId: 'team-1',
      athleteId: 'athlete-1',
      monthlyChargeId: 'charge-missing',
      revisionId: 'payment-revision-1',
      paymentId: 'payment-1',
      amountMinor: 500_000,
      paymentMethod: 'cash',
      paidAt: '2026-10-03',
    }),
    /charge|not found/i,
  )
})

test('manual payment registration prevents cumulative effective overpayment', async () => {
  const existing: PersistedPaymentRevision = {
    revisionId: 'payment-existing-revision-1',
    paymentId: 'payment-existing',
    monthlyChargeId: 'charge-1',
    amountMinor: 1_500_000,
    paymentMethod: 'cash',
    paidAt: '2026-10-02',
    voided: false,
    isCurrent: true,
  }
  const adapter = createBillingPersistenceAdapter(createPort({
    listPaymentRevisions: async () => [existing],
  }) as never)

  await assert.rejects(
    () => adapter.registerManualPayment({
      teamId: 'team-1',
      athleteId: 'athlete-1',
      monthlyChargeId: 'charge-1',
      revisionId: 'payment-new-revision-1',
      paymentId: 'payment-new',
      amountMinor: 750_000,
      paymentMethod: 'bank_transfer',
      paidAt: '2026-10-03',
    }),
    /amount due|overpay|exceed/i,
  )
})

test('semantic retry of the same manual payment does not create duplicate history', async () => {
  const persisted: PersistedPaymentRevision[] = []
  const port = createPort({
    listPaymentRevisions: async () => persisted,
    insertPaymentRevision: async (revision: PersistedPaymentRevision) => {
      persisted.push(revision)
    },
  })
  const adapter = createBillingPersistenceAdapter(port as never)

  const input = {
    teamId: 'team-1',
    athleteId: 'athlete-1',
    monthlyChargeId: 'charge-1',
    revisionId: 'payment-revision-1',
    paymentId: 'payment-1',
    amountMinor: 500_000,
    paymentMethod: 'cash' as const,
    paidAt: '2026-10-03',
  }

  await adapter.registerManualPayment(input)
  await adapter.registerManualPayment({
    ...input,
    revisionId: 'retry-id-must-not-create-history',
  })

  assert.equal(persisted.length, 1)
})

test('SQLite H3 schema versions Payment revisions after H2 and constrains the manual MVP contract', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const root = process.cwd()
  const schema = fs.readFileSync(path.join(root, 'db', 'schema.ts'), 'utf8')
  const journal = JSON.parse(
    fs.readFileSync(path.join(root, 'drizzle', 'sqlite', 'meta', '_journal.json'), 'utf8'),
  ) as { entries: Array<{ tag: string }> }

  assert.match(schema, /paymentRevisions\s*=\s*sqliteTable\(\s*['"]payment_revisions['"]/)
  for (const column of [
    'payment_id',
    'monthly_charge_id',
    'amount_minor',
    'payment_method',
    'paid_at',
    'voided',
    'is_current',
  ]) {
    assert.match(schema, new RegExp(column))
  }
  assert.match(schema, /payment_revisions_amount_positive_check/)
  assert.match(schema, /payment_revisions_method_check/)
  assert.match(schema, /payment_revisions_payment_current_unique/)

  const migration = journal.entries.find(entry => entry.tag.startsWith('0012_'))
  assert.ok(migration, 'missing versioned SQLite H3 Payment migration after H2')
  const sql = fs.readFileSync(path.join(root, 'drizzle', 'sqlite', migration.tag + '.sql'), 'utf8')
  assert.match(sql, /payment_revisions/)
  assert.match(sql, /cash/)
  assert.match(sql, /bank_transfer/)
  assert.doesNotMatch(sql, /card|other|mercado[_ ]?pago/i)
})
