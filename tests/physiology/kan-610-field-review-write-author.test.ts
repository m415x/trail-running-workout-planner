import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-732 review forwards trusted H2 reviewer into atomic SQLite write', () => {
  const application = readFileSync('lib/physiology/field-performance-test-application.ts', 'utf8')
  const start = application.indexOf('export async function reviewCoachTrack1000mEvidence(')
  const end = application.indexOf('export interface ResolveAthleteRunningReferenceInput', start)
  const body = application.slice(start, end)
  assert.ok(body.includes('dependencies.review(input.evidenceId, input.reviewStatus, dependencies.now(), dependencies.reviewedByUserId)'))
  const sqlite = readFileSync('lib/physiology/field-performance-test-sqlite.ts', 'utf8')
  const review = sqlite.slice(sqlite.indexOf('    review(id, reviewStatus, updatedAt'), sqlite.indexOf('    replace(id, replacement, updatedAt'))
  assert.ok(review.includes('reviewedByUserId'))
  assert.ok(review.includes('.set({ reviewStatus, reviewedByUserId, updatedAt })'))
})
