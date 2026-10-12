import assert from 'node:assert/strict'
import test from 'node:test'
import { getCapabilityDefinition } from '../../lib/authorization/capability-catalog'

test('KAN-606 H4C competition management is restricted to TEAM scope', () => {
  const capability = getCapabilityDefinition('competition.manage')
  assert.equal(capability.requiredScope, 'team')
})
