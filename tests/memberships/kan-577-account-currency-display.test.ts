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

test('KAN-577 Intl output includes one locale-specific currency part without an extra suffix', () => {
  for (const locale of ['es-AR', 'en-US']) {
    const formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'ARS',
    }).format(25000)
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'ARS',
    })
    const parts = formatter.formatToParts(25000)
    assert.equal(parts.filter(part => part.type === 'currency').length, 1)
    assert.equal(formatted, parts.map(part => part.value).join(''))
  }
})
