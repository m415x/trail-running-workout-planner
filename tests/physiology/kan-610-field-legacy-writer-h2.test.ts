import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-732 legacy 1000m writer denies without authenticated H2 before persistence', () => {
  const source = readFileSync('app/actions/field-performance-test-actions.ts', 'utf8')
  const start = source.indexOf('export async function createTrack1000mEvidenceAction(')
  const end = source.indexOf('export async function correctTrack1000mEvidenceAction(', start)
  assert.ok(start >= 0)
  const action = source.slice(start, end)
  assert.ok(action.includes('requireAuthenticatedEptAction('), 'legacy writer requires server identity')
  assert.ok(action.includes('readEptSessionAccessState('), 'legacy writer derives identity from verified session')
  assert.ok(action.includes("access.status !== 'authenticated'"), 'DENY before persistence')
})
