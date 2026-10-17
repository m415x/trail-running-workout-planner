import assert from 'node:assert/strict'
import test from 'node:test'

import { buildReviewGenerationInputManifest } from '@/lib/session-generation/review-snapshot-generation-input-manifest'

const input = (microcycleId: string, groupTrainingPlanId = 'plan-a') => ({
  context: {
    groupTrainingPlanId,
    teamId: 'team-a',
    groupId: 'group-a',
    microcycleId,
    frequency: 4,
  },
  templates: [],
})

test('KAN-790 T5.3 rejects mixed-Plan generation inputs in one Plan-scoped manifest', () => {
  assert.throws(
    () => buildReviewGenerationInputManifest({
      groupTrainingPlanId: 'plan-a',
      generationInputs: [input('micro-1'), input('micro-2', 'plan-b')],
    }),
    /plan|scope|source|manifest|identity/i,
  )
})

test('KAN-790 T5.3 rejects duplicate microcycle input in the same manifest', () => {
  assert.throws(
    () => buildReviewGenerationInputManifest({
      groupTrainingPlanId: 'plan-a',
      generationInputs: [input('micro-1'), input('micro-1')],
    }),
    /microcycle|duplicate|source|manifest|identity/i,
  )
})

test('KAN-790 T5.3 rejects missing or blank generation microcycle identity', () => {
  for (const context of [
    { groupTrainingPlanId: 'plan-a', teamId: 'team-a', groupId: 'group-a' },
    { groupTrainingPlanId: 'plan-a', teamId: 'team-a', groupId: 'group-a', microcycleId: ' ' },
  ]) {
    assert.throws(
      () => buildReviewGenerationInputManifest({
        groupTrainingPlanId: 'plan-a',
        generationInputs: [{ context, templates: [] }],
      }),
      /microcycle|source|manifest|identity/i,
    )
  }
})

test('KAN-790 T5.3 accepts two distinct microcycles in one authorized Plan', () => {
  const result = buildReviewGenerationInputManifest({
    groupTrainingPlanId: 'plan-a',
    generationInputs: [input('micro-1'), input('micro-2')],
  })
  assert.equal(result.groupTrainingPlanId, 'plan-a')
  assert.equal(result.generationInputCount, 2)
  assert.match(result.generationInputSha256, /^[a-f0-9]{64}$/)
})
