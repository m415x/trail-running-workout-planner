import assert from 'node:assert/strict'
import test from 'node:test'

import { getTeamEconomicPolicyFormModel } from '../../lib/memberships/membership-policy-form-model'

test('builds the initial policy form in ES when no policy exists', () => {
  assert.deepEqual(
    getTeamEconomicPolicyFormModel({ locale: 'es', policy: null }),
    {
      mode: 'initial',
      title: 'Configurar política económica',
      submitLabel: 'Guardar política',
      monthlyAmountLabel: 'Cuota mensual predeterminada',
      currencyLabel: 'Moneda',
      dueDayLabel: 'Día de vencimiento ordinario',
      effectiveFromLabel: 'Vigente desde',
      effectiveFromHelp: 'La política debe comenzar el primer día de un mes.',
      monthlyAmountMinor: null,
      currency: 'ARS',
      ordinaryDueDay: 5,
    },
  )
})

test('builds a prospective replacement form in EN without mutating the current policy', () => {
  const policy = {
    id: 'policy-1',
    teamId: 'team_1',
    defaultMonthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    ordinaryDueDay: 5,
    effectiveFrom: '2026-10-01',
    effectiveUntil: null,
  }

  assert.deepEqual(
    getTeamEconomicPolicyFormModel({ locale: 'en', policy }),
    {
      mode: 'replacement',
      title: 'Schedule economic policy change',
      submitLabel: 'Schedule change',
      monthlyAmountLabel: 'Default monthly fee',
      currencyLabel: 'Currency',
      dueDayLabel: 'Ordinary due day',
      effectiveFromLabel: 'Effective from',
      effectiveFromHelp: 'The new policy must start on the first day of a month.',
      monthlyAmountMinor: 2_500_000,
      currency: 'ARS',
      ordinaryDueDay: 5,
    },
  )

  assert.equal(policy.effectiveUntil, null)
})
