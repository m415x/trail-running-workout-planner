import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

import { buildAthleteMembershipViewModel } from '../../lib/memberships/athlete-membership-view-model'
import { resolveApplicationRegionalContext } from '../../lib/regionalization/application-regional-context'
import { getMembershipPolicyViewModel } from '../../lib/memberships/membership-policy-view-model'

function formatCurrency(locale: 'es' | 'en', amountMinor: number, currency: string) {
  const { presentationLocale } = resolveApplicationRegionalContext({ language: locale })

  return new Intl.NumberFormat(presentationLocale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100)
}

test('KAN-479 monetary presentation derives the symbol from persisted currency instead of assuming dollars or ARS', async () => {
  const eurPolicy = {
    id: 'policy-eur',
    teamId: 'team_1',
    defaultMonthlyAmountMinor: 2_500_000,
    currency: 'EUR',
    ordinaryDueDay: 5,
    effectiveFrom: '2026-10-01',
    effectiveUntil: null,
  }

  const policyModel = getMembershipPolicyViewModel({
    locale: 'en',
    policy: eurPolicy,
  })

  assert.equal(
    policyModel.monthlyAmount,
    formatCurrency('en', eurPolicy.defaultMonthlyAmountMinor, eurPolicy.currency),
  )
  assert.equal(policyModel.currency, 'EUR')

  const athleteModel = buildAthleteMembershipViewModel({
    locale: 'es',
    onDate: '2026-10-15',
    terms: [{
      id: 'terms-eur',
      athleteId: 'athlete-1',
      monthlyAmountMinor: 2_500_000,
      currency: 'EUR',
      effectiveFrom: '2026-10-01',
      effectiveUntil: null,
    }],
    charges: [{
      athleteId: 'athlete-1',
      billingTermsId: 'terms-eur',
      year: 2026,
      month: 10,
      baseAmountMinor: 2_500_000,
      amountDueMinor: 2_000_000,
      currency: 'EUR',
      baseDueDate: '2026-10-05',
      effectiveDueDate: '2026-10-05',
    }],
  })

  assert.equal(
    athleteModel.currentTerms?.monthlyAmount,
    formatCurrency('es', 2_500_000, 'EUR'),
  )
  assert.equal(
    athleteModel.charges[0]?.amountDue,
    formatCurrency('es', 2_000_000, 'EUR'),
  )

  const athleteForm = await readFile(
    'features/memberships/components/AthleteBillingTermsForm.tsx',
    'utf8',
  )
  assert.doesNotMatch(
    athleteForm,
    /monthlyCharges\.find\(\(charge\) => charge\.id === revision\.monthlyChargeId\)\?\.currency \?\? 'ARS'/,
  )
})


test('KAN-506 presentation locale never infers economic currency', () => {
  const esAr = resolveApplicationRegionalContext({ language: 'es' }).presentationLocale
  const enUs = resolveApplicationRegionalContext({ language: 'en' }).presentationLocale

  assert.match(new Intl.NumberFormat(esAr, { style: 'currency', currency: 'EUR' }).format(10), /€/)
  assert.match(new Intl.NumberFormat(enUs, { style: 'currency', currency: 'EUR' }).format(10), /€/)
})
