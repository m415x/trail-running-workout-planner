import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const root = process.cwd()
const upgrade = fs.readFileSync(path.join(root, 'scripts', 'upgrade-sqlite.ts'), 'utf8')

test('SQLite upgrade refuses incompatible duplicate Session + microcycle prescriptions before migration', () => {
  assert.match(upgrade, /group_session_prescriptions/i)
  assert.match(upgrade, /GROUP BY\s+session_id\s*,\s*microcycle_id/i)
  assert.match(upgrade, /HAVING\s+COUNT\(\*\)\s*>\s*1/i)
  assert.match(upgrade, /duplicate.*session.*microcycle|session.*microcycle.*duplicate/i)
  assert.match(upgrade, /refus|reject|throw/i)
})
