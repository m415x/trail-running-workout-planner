import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('app/actions/field-performance-test-actions.ts', 'utf8')

test('KAN-606 T2 Coach official 1000m creation explicitly requires H3 field evidence capability before eligible TestEvent lookup', () => {
  const start = source.indexOf('export async function createCoachTrack1000mEvidenceAction(')
  const end = source.indexOf('export async function getCoachTrack1000mTestEventsAction(', start)
  assert.ok(start >= 0 && end > start, 'Expected official Coach writer boundary')
  const action = source.slice(start, end)

  const authorization = action.indexOf("'field_evidence_1000m.manage'")
  const eligibility = action.indexOf('resolveEligibleTestEvent(')
  assert.ok(authorization >= 0, 'Official Coach write must explicitly enforce field_evidence_1000m.manage')
  assert.ok(authorization < eligibility, 'H3 DENY must precede TestEvent and athlete data reads')
  assert.match(action, /recordedByUserId\s*:\s*recordedByUserId/, 'Keep server-owned H7A recorder provenance')
})
