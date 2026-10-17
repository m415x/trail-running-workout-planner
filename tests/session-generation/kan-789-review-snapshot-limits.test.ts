import assert from 'node:assert/strict'
import test from 'node:test'

import {
  validateSessionGenerationSnapshotEnvelope,
  SESSION_GENERATION_SNAPSHOT_LIMITS,
} from '@/lib/session-generation/review-snapshot-limits'

const payload = {
  proposal: { sessions: [{ id: 's-1' }] },
  generationExplanations: { 's-1': { stage: 'reference' } },
  sourceManifest: { planRevision: 'rev-1' },
}

test('KAN-789 snapshot TTL and count limits are canonical server-owned constants', () => {
  assert.equal(SESSION_GENERATION_SNAPSHOT_LIMITS.ttlMinutes, 30)
  assert.equal(SESSION_GENERATION_SNAPSHOT_LIMITS.maxActivePerOwnerPlan, 2)
  assert.equal(SESSION_GENERATION_SNAPSHOT_LIMITS.maxBytes, 4 * 1024 * 1024)
  assert.equal(SESSION_GENERATION_SNAPSHOT_LIMITS.maxSessions, 500)
  assert.equal(SESSION_GENERATION_SNAPSHOT_LIMITS.maxMicrocycles, 60)
})

test('KAN-789 server validates serialized UTF-8 size, not JS character count', () => {
  const padded = { ...payload, sourceManifest: { note: 'á'.repeat(2 * 1024 * 1024) } }
  assert.throws(() => validateSessionGenerationSnapshotEnvelope({
    ...padded, sessionCount: 1, microcycleCount: 1,
  }), /snapshot.*(size|bytes|limit)/i)
})

test('KAN-789 fails closed at session and microcycle boundaries', () => {
  assert.doesNotThrow(() => validateSessionGenerationSnapshotEnvelope({
    ...payload, sessionCount: 500, microcycleCount: 60,
  }))
  for (const [sessionCount, microcycleCount] of [[501, 1], [1, 61], [-1, 1], [1, -1]]) {
    assert.throws(() => validateSessionGenerationSnapshotEnvelope({
      ...payload, sessionCount, microcycleCount,
    }), /snapshot.*(sessions|microcycles|limit)/i)
  }
})

test('KAN-789 never trusts client-shaped or unserializable payloads', () => {
  assert.throws(() => validateSessionGenerationSnapshotEnvelope({
    ...payload, proposal: { input: undefined }, sessionCount: 1, microcycleCount: 1,
  }), /snapshot.*(payload|serializ)/i)
})
