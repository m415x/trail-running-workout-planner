import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('features/memberships/components/AthleteBillingTermsForm.tsx', 'utf8')
const es = JSON.parse(readFileSync('messages/es/memberships/membership.json', 'utf8')).Membership.athleteBilling
const en = JSON.parse(readFileSync('messages/en/memberships/membership.json', 'utf8')).Membership.athleteBilling

test('KAN-573 gives Coach membership payment fields explicit localized names', () => {
  for (const [field, key] of [
    ['paymentChargeId', 'common.selectCharge'],
    ['paymentAmount', 'common.amount'],
    ['paymentMethod', 'payments.method'],
    ['paidAt', 'payments.date'],
  ] as const) {
    const input = new RegExp(`<(?:Input|select)\\b[^>]*name=['"]${field}['"][^>]*>`)
    assert.match(source, input, `payment form must retain field ${field}`)
    const label = new RegExp(`<(?:Input|select)\\b[^>]*name=['"]${field}['"][^>]*aria-label=\\{t\\(['"]${key.replaceAll('.', '\\.') }['"]\\)\\}[^>]*>`)
    assert.match(source, label, `${field} must expose its localized field name`)
  }

  for (const messages of [es, en]) {
    assert.ok(messages.common.selectCharge)
    assert.ok(messages.common.amount)
    assert.ok(messages.payments.method)
    assert.ok(messages.payments.date)
  }
})
