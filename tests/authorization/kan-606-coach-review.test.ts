import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('app/actions/field-performance-test-actions.ts', 'utf8')

test('KAN-606 T3 Coach review requires field-evidence H3 permission before mutation', () => {
  const start = source.indexOf('export async function reviewCoachTrack1000mEvidenceAction(')
  const end = source.indexOf('export async function getCoachTrack1000mAuditHistoryAction(', start)
  assert.ok(start >= 0 && end > start)
  const action = source.slice(start, end)
  const capability = action.indexOf("'field_evidence_1000m.manage'")
  assert.ok(capability >= 0, 'Coach review must explicitly require H3 permission')
  assert.ok(capability < action.indexOf('return reviewCoachTrack1000mEvidence('))
  assert.match(action, /not_authorized/)
})
