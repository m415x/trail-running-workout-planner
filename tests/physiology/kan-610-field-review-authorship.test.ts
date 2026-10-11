import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-732 review derives authenticated H2 reviewer rather than client input', () => {
  const source = readFileSync('app/actions/field-performance-test-actions.ts', 'utf8')
  const start = source.indexOf('export async function reviewCoachTrack1000mEvidenceAction(')
  const end = source.indexOf('export async function getCoachTrack1000mHistoryAction(', start)
  assert.ok(start >= 0)
  const body = source.slice(start, end)
  assert.ok(body.includes('requireAuthenticatedEptAction('))
  assert.ok(body.includes('readEptSessionAccessState('))
  assert.ok(body.includes('reviewedByUserId:'))
  assert.ok(!body.includes('reviewedByUserId: input.reviewedByUserId'))
})
