import assert from 'node:assert/strict'
import test from 'node:test'

import { projectReviewSqlGenerationPreferences } from '@/lib/session-generation/review-snapshot-effective-preferences'
import { resolveSessionGenerationPreferences } from '@/lib/session-generation/generation-preferences-persistence'

const scope = { groupTrainingPlanId: 'plan-a', teamId: 'team-a', groupId: 'group-a' }

test('KAN-790 T5.3 projects persisted scoped preferences through existing domain resolver', () => {
  const stored = {
    ...scope,
    frequencyMode: 'fixed' as const,
    fixedSessionsPerWeek: 3,
    weeklyPattern: [
      { weekday: 'monday', role: 'base' },
      { weekday: 'wednesday', role: 'quality' },
      { weekday: 'saturday', role: 'long' },
    ],
  }
  const actual = projectReviewSqlGenerationPreferences(stored)
  const expected = resolveSessionGenerationPreferences({
    frequencyMode: stored.frequencyMode,
    fixedSessionsPerWeek: stored.fixedSessionsPerWeek,
    weeklyPattern: stored.weeklyPattern as Array<{ weekday: 'monday' | 'wednesday' | 'saturday'; role: 'base' | 'quality' | 'long' }>,
  })
  assert.deepEqual(actual, expected)
  assert.deepEqual(actual.frequency, { mode: 'fixed', sessionsPerWeek: 3 })
  assert.equal(actual.pattern.slots.length, 3)
})

test('KAN-790 T5.3 absent persisted preferences use real server defaults, not an empty pattern', () => {
  assert.deepEqual(
    projectReviewSqlGenerationPreferences(null),
    resolveSessionGenerationPreferences(null),
  )
  assert.ok(projectReviewSqlGenerationPreferences(null).pattern.slots.length >= 3)
})

test('KAN-790 T5.3 invalid persisted preference mode or weekday fails closed', () => {
  assert.throws(
    () => projectReviewSqlGenerationPreferences({
      ...scope, frequencyMode: 'broken' as 'fixed', fixedSessionsPerWeek: 3,
      weeklyPattern: [{ weekday: 'monday', role: 'base' }],
    }),
    /invalid|frequency|preferenc|mode/i,
  )
  assert.throws(
    () => projectReviewSqlGenerationPreferences({
      ...scope, frequencyMode: 'fixed', fixedSessionsPerWeek: 3,
      weeklyPattern: [
        { weekday: 'monday', role: 'base' },
        { weekday: 'blursday', role: 'quality' },
        { weekday: 'saturday', role: 'long' },
      ],
    }),
    /invalid|weekday|día|blursday/i,
  )
})
