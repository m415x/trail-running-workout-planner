import assert from 'node:assert/strict'
import test from 'node:test'

import { CAPABILITY_CATALOG } from '@/lib/authorization/capability-catalog'

test('KAN-646/T5 biometrics read and manage are explicit nondelegable SELF capabilities', () => {
  for (const key of ['physiology.biometric.self.read', 'physiology.biometric.self.manage']) {
    const entries = CAPABILITY_CATALOG.filter((entry) => entry.key === key)
    assert.equal(entries.length, 1)
    const capability = entries[0]
    assert.ok('requiredScope' in capability)
    assert.equal(capability.requiredScope, 'self')
    assert.equal(capability.delegable, false)
    assert.equal(capability.structural, false)
    assert.deepEqual([...capability.basePresets], ['athlete', 'assistant', 'coach', 'admin'])
  }
})

test('KAN-646/T5 existing physiology.self.read remains distinct from raw biometric authority', () => {
  const old = CAPABILITY_CATALOG.find((entry) => entry.key === 'physiology.self.read')
  const biometric = CAPABILITY_CATALOG.find((entry) => entry.key === 'physiology.biometric.self.read')
  assert.ok(old)
  assert.ok(biometric)
  assert.notEqual(old.key, biometric.key)
})
