import assert from 'node:assert/strict'
import test from 'node:test'

import { getMembershipPolicyViewModel } from '../../lib/memberships/membership-policy-view-model'

test('builds the Coach membership policy view model in ES and EN without H2+ concepts', () => {
  const policy = {
    id: 'policy-1',
    teamId: 'team_1',
    defaultMonthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    ordinaryDueDay: 5,
    effectiveFrom: '2026-10-01',
    effectiveUntil: null,
  }

  assert.deepEqual(getMembershipPolicyViewModel({ locale: 'es', policy }), {
    title: 'Membresía',
    policyTitle: 'Política económica del equipo',
    monthlyAmountLabel: 'Cuota mensual predeterminada',
    monthlyAmount: '$25.000',
    currencyLabel: 'Moneda',
    currency: 'ARS',
    dueDayLabel: 'Día de vencimiento ordinario',
    dueDay: '5',
    effectiveFromLabel: 'Vigente desde',
    effectiveFrom: '2026-10-01',
    effectiveUntil: null,
    emptyState: 'Todavía no hay una política económica configurada.',
  })

  assert.deepEqual(getMembershipPolicyViewModel({ locale: 'en', policy }), {
    title: 'Membership',
    policyTitle: 'Team economic policy',
    monthlyAmountLabel: 'Default monthly fee',
    monthlyAmount: '$25,000',
    currencyLabel: 'Currency',
    currency: 'ARS',
    dueDayLabel: 'Ordinary due day',
    dueDay: '5',
    effectiveFromLabel: 'Effective from',
    effectiveFrom: '2026-10-01',
    effectiveUntil: null,
    emptyState: 'No economic policy has been configured yet.',
  })
})

test('supports the empty H1 state without inventing payment or debt status', () => {
  const view = getMembershipPolicyViewModel({ locale: 'es', policy: null })

  assert.equal(view.monthlyAmount, null)
  assert.equal(view.currency, null)
  assert.equal(view.dueDay, null)
  assert.equal(view.effectiveFrom, null)
  assert.doesNotMatch(JSON.stringify(view), /pagad|deuda|vencid|pending|overdue|settled/i)
})
