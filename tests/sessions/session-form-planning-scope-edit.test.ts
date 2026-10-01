import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { it } from 'node:test'

const source = readFileSync('features/sessions/components/SessionForm.tsx', 'utf8')

it('reconstructs editing state for every persisted microcycle rather than overwriting by group', () => {
  assert.match(source, /session\?\.sessionPrescriptions\.map\(\(item\) => \[item\.microcycleId, \{/)
  assert.match(source, /session\?\.sessionPrescriptions\.map\(\(item\) => \[item\.microcycleId, item\.intensityMethod/)
  assert.doesNotMatch(source, /session\?\.sessionPrescriptions\.find\(\(item\) => item\.groupId === group\.id\)/)
})

it('renders an editable prescription row per selected microcycle, not a single card per group', () => {
  assert.match(source, /selectedMicrocycleIds/)
  assert.match(source, /group\.microcycles\.filter\(/)
  assert.match(source, /prescriptionMicrocycleId' value=\{microcycleId\}/)
  assert.doesNotMatch(source, /groups\.map\(\(group\) => \{[\s\S]*?const current = session\?\.sessionPrescriptions\.find/)
})
