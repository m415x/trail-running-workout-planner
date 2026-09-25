import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('Coach membership page renders the policy snapshot and prospective form', async () => {
  const source = await readFile(
    'app/[locale]/dashboard/membership/page.tsx',
    'utf8',
  )

  assert.match(source, /MembershipPolicyCard model=\{model\.policy\}/)
  assert.match(source, /TeamEconomicPolicyForm/)
  assert.match(source, /model=\{model\.form\}/)
  assert.match(source, /locale=\{supportedLocale\}/)
})
