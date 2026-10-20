import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

test('KAN-838 acceptance public dispatch is not a direct two-command chain', () => {
  const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { scripts: Record<string, string> }
  assert.equal(pkg.scripts['db:seed:acceptance'], 'tsx scripts/seed-acceptance-disposable.ts')
})
