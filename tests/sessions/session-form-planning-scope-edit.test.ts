import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { it } from 'node:test'

const source = readFileSync('features/sessions/components/SessionForm.tsx', 'utf8')

it('reconstructs editing state for every persisted microcycle rather than overwriting by group', () => {
  assert.match(source, /session\?\.sessionPrescriptions\.map\(\(item\) => \[item\.microcycleId, \{/)
  assert.match(source, /session\?\.sessionPrescriptions\.map\(\(item\) => \[item\.microcycleId, item\.intensityMethod/)
  assert.doesNotMatch(source, /session\?\.sessionPrescriptions\.find\(\(item\) => item\.groupId === group\.id\)/)
})
