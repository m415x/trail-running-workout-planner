import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('app/actions/field-performance-test-actions.ts', 'utf8')

test('KAN-606 T8 legacy field evidence action cannot bypass Coach H3 permission', () => {
  const start = source.indexOf('export async function createTrack1000mEvidenceAction(')
  const end = source.indexOf('export async function correctTrack1000mEvidenceAction(', start)
  assert.ok(start >= 0 && end > start)
  const action = source.slice(start, end)
  const capability = action.indexOf("'field_evidence_1000m.manage'")
  assert.ok(capability >= 0, 'Legacy writer must not bypass official evidence capability')
  assert.ok(capability < action.indexOf('return createTrack1000mEvidence('))
})
