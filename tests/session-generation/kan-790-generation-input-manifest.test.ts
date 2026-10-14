import assert from 'node:assert/strict'
import test from 'node:test'

import { buildReviewGenerationInputManifest } from '@/lib/session-generation/review-snapshot-generation-input-manifest'

const source = {
  groupTrainingPlanId: 'plan-base',
  generationInputs: [
    { context: { microcycleId: 'micro-1', groupTrainingPlanId: 'plan-base', teamId: 'team-a', frequency: 4 }, templates: [{ id: 'template-a', load: 6 }] },
  ],
}

test('KAN-790 T5.3 identical server-resolved generation inputs produce deterministic Plan-scoped manifest', () => {
  const a = buildReviewGenerationInputManifest(source)
  const b = buildReviewGenerationInputManifest({
    generationInputs: [{ templates: [{ load: 6, id: 'template-a' }],
      context: { frequency: 4, teamId: 'team-a', groupTrainingPlanId: 'plan-base', microcycleId: 'micro-1' } }],
    groupTrainingPlanId: 'plan-base',
  })
  assert.deepEqual(a, b)
  assert.equal(a.groupTrainingPlanId, 'plan-base')
  assert.equal(a.manifestVersion, 1)
  assert.match(a.generationInputSha256, /^[a-f0-9]{64}$/)
  assert.equal(a.generationInputCount, 1)
})

test('KAN-790 T5.3 changed Plan identity, microcycle input or template facts changes source manifest', () => {
  const baseline = buildReviewGenerationInputManifest(source)
  assert.throws(
    () => buildReviewGenerationInputManifest({ ...source, groupTrainingPlanId: 'plan-variant' }),
    /plan|scope|source|manifest/i,
    'Cross-Plan inputs cannot yield an authoritative manifest',
  )
  for (const change of [
    { ...source, generationInputs: [{ context: { microcycleId: 'micro-2', groupTrainingPlanId: 'plan-base', teamId: 'team-a', frequency: 4 }, templates: [{ id: 'template-a', load: 6 }] }] },
    { ...source, generationInputs: [{ context: { microcycleId: 'micro-1', groupTrainingPlanId: 'plan-base', teamId: 'team-a', frequency: 4 }, templates: [{ id: 'template-a', load: 7 }] }] },
  ]) {
    assert.notDeepEqual(buildReviewGenerationInputManifest(change), baseline)
  }
})

test('KAN-790 T5.3 malformed or missing server generation inputs cannot yield authoritative manifest', () => {
  for (const value of [
    { ...source, groupTrainingPlanId: ' ' },
    { ...source, generationInputs: null },
    { ...source, generationInputs: [] },
    { ...source, generationInputs: [{ context: { value: Number.NaN } }] },
    { ...source, generationInputs: [{ context: undefined }] },
  ]) {
    assert.throws(
      () => buildReviewGenerationInputManifest(value),
      /manifest|source|input|invalid|empty|serializ/i,
    )
  }
})

test('KAN-790 T5.3 manifest builder preserves source inputs without mutation', () => {
  const before = structuredClone(source)
  buildReviewGenerationInputManifest(source)
  assert.deepEqual(source, before)
})
