import assert from 'node:assert/strict'
import test from 'node:test'

import {
  validateSessionGenerationSnapshotEnvelope,
  SESSION_GENERATION_SNAPSHOT_LIMITS,
} from '@/lib/session-generation/review-snapshot-limits'

const envelope = (proposal: unknown, generationExplanations: unknown = {}) => ({
  proposal, generationExplanations, sourceManifest: { revision: 'r1' },
  sessionCount: 1, microcycleCount: 1,
})

test('KAN-789 caps actual group prescriptions independently from client-supplied sessionCount', () => {
  assert.equal(SESSION_GENERATION_SNAPSHOT_LIMITS.maxPrescriptions, 500)
  const over = { events: [{
    sharedEventKey: 'event-1',
    prescriptions: Array.from({ length: 501 }, (_, index) => ({ generationKey: `gen-${index}` })),
  }] }
  assert.throws(() => validateSessionGenerationSnapshotEnvelope(envelope(over)),
    /snapshot.*(prescriptions|complexity|limit)/i)
  assert.doesNotThrow(() => validateSessionGenerationSnapshotEnvelope(
    envelope({ events: [{ prescriptions: Array.from({ length: 500 }, () => ({})) }] }),
  ))
})

test('KAN-789 bounds explanation stage cardinality regardless of byte-size', () => {
  assert.equal(SESSION_GENERATION_SNAPSHOT_LIMITS.maxExplanationStages, 9)
  const large = { key: { stages: Array.from({ length: 10 }, (_, index) => ({ stage: `stage-${index}` })) } }
  assert.throws(() => validateSessionGenerationSnapshotEnvelope(envelope({ events: [] }, large)),
    /snapshot.*(stage|complexity|limit)/i)
})

test('KAN-789 limits nested explanation facts to prevent bounded-byte complexity attacks', () => {
  assert.equal(SESSION_GENERATION_SNAPSHOT_LIMITS.maxFactsPerExplanationStage, 256)
  const excessive = {
    'gen-1': { stages: [{
      stage: 'weekly_budget',
      inputs: Array.from({ length: 257 }, (_, i) => ({ code: `fact-${i}`, value: i })),
    }] },
  }
  assert.throws(() => validateSessionGenerationSnapshotEnvelope(envelope({ events: [] }, excessive)),
    /snapshot.*(fact|complexity|limit)/i)
})
