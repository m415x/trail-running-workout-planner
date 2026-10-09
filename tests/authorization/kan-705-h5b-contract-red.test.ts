import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { CAPABILITY_CATALOG } from '@/lib/authorization/capability-catalog'

test('KAN-705 H5B SELF reads are distinct, non-delegable and present in all four presets', () => {
  for (const key of ['stats.self.read', 'physiology.self.read']) {
    const definition = CAPABILITY_CATALOG.find((entry) => entry.key === key)
    assert.ok(definition, 'Missing explicit SELF read capability: ' + key)
    assert.equal(definition.delegable, false)
    assert.equal('requiredScope' in definition ? definition.requiredScope : undefined, 'self')
    assert.deepEqual([...definition.basePresets], ['athlete', 'assistant', 'coach', 'admin'])
  }
})

test('KAN-705 durable H3 contract distinguishes athlete physiology disclosure from Coach authority', () => {
  const h3 = readFileSync('docs/architecture/platform/authorization-capabilities-scopes.md', 'utf8')
  assert.match(h3, /stats\.self\.read/)
  assert.match(h3, /physiology\.self\.read/)
  assert.match(h3, /RunningReference/)
  assert.match(h3, /1000/)
  assert.match(h3, /physiology\.read/)
  assert.match(h3, /field_evidence_1000m\.manage/)
})
