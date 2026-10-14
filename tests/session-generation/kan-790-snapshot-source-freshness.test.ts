import assert from 'node:assert/strict'
import test from 'node:test'

import { evaluateReviewSnapshotSourceFreshness } from '@/lib/session-generation/review-snapshot-source-freshness'

test('KAN-790 T5.3 same server-owned source facts compare equal regardless of JSON property order', () => {
  const generated = { plan: { id: 'plan-a', revision: 3 }, templates: [{ id: 'template-1', version: 2 }] }
  const current = { templates: [{ version: 2, id: 'template-1' }], plan: { revision: 3, id: 'plan-a' } }
  assert.deepEqual(evaluateReviewSnapshotSourceFreshness(generated, current), { kind: 'current' })
})

test('KAN-790 T5.3 changed source facts require generation_stale rather than reconciliation_conflict', () => {
  const generated = { plan: { id: 'plan-a', revision: 3 }, templates: [{ id: 'template-1', version: 2 }] }
  const current = { plan: { id: 'plan-a', revision: 4 }, templates: [{ id: 'template-1', version: 2 }] }
  assert.deepEqual(evaluateReviewSnapshotSourceFreshness(generated, current), { kind: 'generation_stale' })
})

test('KAN-790 T5.3 missing manifest or non-JSON source facts fail closed', () => {
  const manifest = { plan: { id: 'plan-a', revision: 3 } }
  assert.deepEqual(evaluateReviewSnapshotSourceFreshness(null, manifest), { kind: 'generation_stale' })
  assert.deepEqual(evaluateReviewSnapshotSourceFreshness(manifest, null), { kind: 'generation_stale' })
  assert.deepEqual(evaluateReviewSnapshotSourceFreshness({}, manifest), { kind: 'generation_stale' })
  assert.deepEqual(evaluateReviewSnapshotSourceFreshness(manifest, { plan: { id: 'plan-a', revision: Number.NaN } }), { kind: 'generation_stale' })
})

test('KAN-790 T5.3 comparison never mutates either manifest', () => {
  const generated = { plan: { id: 'plan-a', revision: 3 }, templates: [{ id: 't', version: 1 }] }
  const current = structuredClone(generated)
  const beforeGenerated = structuredClone(generated)
  const beforeCurrent = structuredClone(current)
  assert.deepEqual(evaluateReviewSnapshotSourceFreshness(generated, current), { kind: 'current' })
  assert.deepEqual(generated, beforeGenerated)
  assert.deepEqual(current, beforeCurrent)
})
