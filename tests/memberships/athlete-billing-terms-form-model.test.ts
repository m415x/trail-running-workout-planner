import assert from 'node:assert/strict'
import test from 'node:test'

import { getAthleteBillingTermsFormModel } from '../../lib/memberships/athlete-billing-terms-form-model'

test('initial athlete billing terms may start on any calendar day', () => {
  const model = getAthleteBillingTermsFormModel({
    locale: 'es',
    currentTerms: null,
  })

  assert.equal(model.mode, 'initial')
  assert.equal(model.title, 'Condiciones económicas')
  assert.equal(model.submitLabel, 'Aplicar condiciones')
  assert.match(model.effectiveFromHelp, /cualquier día/i)
  assert.equal('monthlyAmount' in model, false)
  assert.equal('currency' in model, false)
})

test('prospective athlete billing terms replacement starts on the first day of a month', () => {
  const model = getAthleteBillingTermsFormModel({
    locale: 'en',
    currentTerms: {
      monthlyAmountMinor: 2_500_000,
      currency: 'ARS',
    },
  })

  assert.equal(model.mode, 'replacement')
  assert.equal(model.title, 'Economic terms')
  assert.equal(model.submitLabel, 'Schedule change')
  assert.equal(model.monthlyAmount, '25000')
  assert.equal(model.currency, 'ARS')
  assert.match(model.effectiveFromHelp, /first day of a month/i)
})

test('athlete billing terms form model does not introduce H2+ concepts', () => {
  const model = getAthleteBillingTermsFormModel({
    locale: 'es',
    currentTerms: null,
  })

  const serialized = JSON.stringify(model).toLowerCase()
  for (const forbidden of ['scholarship', 'beca', 'payment', 'pago', 'overdue', 'deuda', 'extension', 'prórroga']) {
    assert.equal(serialized.includes(forbidden), false)
  }
})
