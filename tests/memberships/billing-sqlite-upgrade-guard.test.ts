import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

test('versioned SQLite state rejects partial H1 billing schema before migration', () => {
  const upgrade = fs.readFileSync(path.join(process.cwd(), 'scripts', 'upgrade-sqlite.ts'), 'utf8')

  assert.match(upgrade, /team_economic_policies/)
  assert.match(upgrade, /athlete_billing_terms/)
  assert.match(upgrade, /monthly_charges/)
  assert.match(upgrade, /billing schema is inconsistent/i)
  assert.match(upgrade, /refusing automatic migration/i)
})
