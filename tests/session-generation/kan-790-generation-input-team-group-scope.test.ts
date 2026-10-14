import assert from 'node:assert/strict'
import test from 'node:test'

import { buildReviewGenerationInputManifest } from '@/lib/session-generation/review-snapshot-generation-input-manifest'

const weeklyInput = (microcycleId: string, teamId = 'team-a', groupId = 'group-a') => ({
  context: { groupTrainingPlanId: 'plan-a', teamId, groupId, microcycleId, frequency: 4 },
  templates: [],
})

test('KAN-790 T5.3 rejects a generation input from a different Team within one Plan', () => {
  assert.throws(() => buildReviewGenerationInputManifest({
    groupTrainingPlanId: 'plan-a',
    generationInputs: [weeklyInput('week-1'), weeklyInput('week-2', 'team-b')],
  }), /team|scope|source|identity/i)
})

test('KAN-790 T5.3 rejects a generation input from a different Sporting Group within one Plan', () => {
  assert.throws(() => buildReviewGenerationInputManifest({
    groupTrainingPlanId: 'plan-a',
    generationInputs: [weeklyInput('week-1'), weeklyInput('week-2', 'team-a', 'group-b')],
  }), /group|scope|source|identity/i)
})

test('KAN-790 T5.3 rejects absent or blank Team and Group identifiers before signing input facts', () => {
  for (const context of [
    { groupTrainingPlanId: 'plan-a', microcycleId: 'week-1', groupId: 'group-a', frequency: 4 },
    { groupTrainingPlanId: 'plan-a', microcycleId: 'week-1', teamId: 'team-a', frequency: 4 },
    { groupTrainingPlanId: 'plan-a', microcycleId: 'week-1', teamId: ' ', groupId: 'group-a' },
    { groupTrainingPlanId: 'plan-a', microcycleId: 'week-1', teamId: 'team-a', groupId: ' ' },
  ]) {
    assert.throws(() => buildReviewGenerationInputManifest({
      groupTrainingPlanId: 'plan-a',
      generationInputs: [{ context, templates: [] }],
    }), /team|group|scope|source|identity/i)
  }
})

test('KAN-790 T5.3 accepts distinct weeks from one Plan, Team and Sporting Group', () => {
  const manifest = buildReviewGenerationInputManifest({
    groupTrainingPlanId: 'plan-a',
    generationInputs: [weeklyInput('week-1'), weeklyInput('week-2')],
  })
  assert.equal(manifest.generationInputCount, 2)
  assert.match(manifest.generationInputSha256, /^[0-9a-f]{64}$/)
})
