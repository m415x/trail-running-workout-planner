import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-732 correction resolves H2 actor before writing 1000m replacement', () => {
  const source = readFileSync('app/actions/field-performance-test-actions.ts', 'utf8')
  const start = source.indexOf('export async function correctTrack1000mEvidenceAction(')
  const end = source.indexOf('\nexport ', start + 1)
  assert.ok(start >= 0)
  const action = source.slice(start, end < 0 ? undefined : end)
  assert.ok(action.includes('requireAuthenticatedEptAction('), 'correction requires authenticated H2 server actor')
  assert.ok(action.includes('readEptSessionAccessState('), 'correction must derive actor from server session')
  assert.ok(action.includes('recordedByUserId:'), 'correction must forward trusted recorder, not replacement input')
  assert.ok(!action.includes('recordedByUserId: input.replacement.recordedByUserId'), 'replacement cannot spoof recorder')
})
