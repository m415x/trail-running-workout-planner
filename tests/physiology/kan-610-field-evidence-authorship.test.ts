import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-732 coach 1000m creation derives recorder from trusted server actor, never client coachUserId', () => {
  const source = readFileSync('app/actions/field-performance-test-actions.ts', 'utf8')
  const start = source.indexOf('export async function createCoachTrack1000mEvidenceAction(')
  const end = source.indexOf('\nexport async function ', start + 1)
  assert.ok(start >= 0)
  const body = source.slice(start, end)
  assert.ok(body.includes('requireAuthenticatedEptAction('), 'coach write must resolve server H2 actor')
  assert.ok(body.includes('readEptSessionAccessState('), 'coach write must not trust client actor')
  assert.ok(body.includes('recordedByUserId:'), 'coach write must propagate authenticated recorder')
  assert.ok(!body.includes('recordedByUserId: input.coachUserId'), 'client coachUserId is never trusted')
})
