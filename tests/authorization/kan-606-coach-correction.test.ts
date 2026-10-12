import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('app/actions/field-performance-test-actions.ts', 'utf8')

test('KAN-606 T3 Coach correction requires explicit H3 field-evidence authority', () => {
  const start = source.indexOf('export async function correctTrack1000mEvidenceAction(')
  const end = source.indexOf('function testEventPerformedAt(', start)
  assert.ok(start >= 0 && end > start)
  const action = source.slice(start, end)
  const capability = action.indexOf("'field_evidence_1000m.manage'")
  assert.ok(capability >= 0, 'Coach correction must require H3 capability')
  assert.ok(capability < action.indexOf('return correctTrack1000mEvidence('))
})
