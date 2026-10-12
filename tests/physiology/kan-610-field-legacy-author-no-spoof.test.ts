import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-732 legacy writer replaces client author with authenticated H2 identity', () => {
  const src = readFileSync('app/actions/field-performance-test-actions.ts', 'utf8')
  const start = src.indexOf('export async function createTrack1000mEvidenceAction(')
  const end = src.indexOf('export async function correctTrack1000mEvidenceAction(', start)
  assert.ok(start >= 0 && end > start)
  const action = src.slice(start, end)
  assert.match(action, /if \(access\.status !== 'authenticated'\)\s*\{\s*return \{ success: false as const, error: 'not_authorized' as const \}/)
  assert.match(action, /createTrack1000mEvidence\(\s*\{ \.\.\.input, recordedByUserId: access\.userId \}/)
  assert.match(action, /capability: 'field_evidence_1000m\.manage'/)
  assert.match(action, /resolveOwnedAthlete: async \(id: string\) => id === athlete\.id/)
  assert.ok(action.indexOf("access.status !== 'authenticated'") < action.indexOf('createTrack1000mEvidence('))
})
