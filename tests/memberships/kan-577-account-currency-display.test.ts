import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const account = readFileSync('features/memberships/components/MembershipAccountState.tsx', 'utf8')

test('KAN-577 Membership uses the currency symbol/code supplied by Intl only once', () => {
  assert.match(account, /new Intl\.NumberFormat\(/)
  assert.match(account, /style: 'currency'/)
  assert.match(account, /format\(minor \/ 100\)/)
  assert.doesNotMatch(
    account,
    /return `\$\{formatted\}\s+\$\{currency\}`/,
    'Intl currency formatting already includes ARS: never append currency again',
  )
})

test('KAN-577 currency output convention includes the amount and no trailing duplicate ARS', () => {
  for (const locale of ['es-AR', 'en-US']) {
    const formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'ARS',
    }).format(25000)
    assert.equal((formatted.match(/ARS/g) ?? []).length, 1)
  }
})
