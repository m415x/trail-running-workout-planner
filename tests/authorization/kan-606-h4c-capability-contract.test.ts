import assert from 'node:assert/strict'
import test from 'node:test'

import { CAPABILITY_CATALOG } from '../../lib/authorization/capability-catalog'

test('KAN-606 H4C declares competition.manage as COACH-only, nondelegable authority', () => {
  const capability = CAPABILITY_CATALOG.find((entry) => entry.key === 'competition.manage')
  assert.ok(capability, 'H4C must declare the explicit competition.manage capability')
  assert.deepEqual(capability.basePresets, ['coach'])
  assert.equal(capability.delegable, false)
  assert.equal(capability.structural, false)
})

test('KAN-606 H4C does not infer competition authority from generic sporting capabilities', () => {
  const generic = ['training.coordinate', 'planning.manage', 'athlete.admin.manage'] as const
  for (const key of generic) {
    const existing = CAPABILITY_CATALOG.find((entry) => entry.key === key)
    assert.ok(existing, `Baseline capability missing: ${key}`)
    assert.notEqual(existing.key, 'competition.manage')
  }
})
