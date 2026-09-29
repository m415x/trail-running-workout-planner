import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const source = fs.readFileSync(
  path.join(process.cwd(), 'app', 'actions', 'session-generation-actions.ts'),
  'utf8',
)

test('generated prescription create collisions are resolved by Session + microcycle planning scope', () => {
  assert.match(
    source,
    /eq\(groupSessionPrescriptions\.sessionId,\s*sessionId\)[\s\S]*eq\(groupSessionPrescriptions\.microcycleId,\s*values\.microcycleId\)/,
  )
  assert.doesNotMatch(
    source,
    /eq\(groupSessionPrescriptions\.sessionId,\s*sessionId\)[\s\S]{0,220}eq\(groupSessionPrescriptions\.groupId,\s*values\.groupId\)/,
  )
})
