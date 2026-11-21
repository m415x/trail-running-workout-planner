import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('KAN-879 RED-2 createSession writes validated vertical fields as typed DB columns in its existing transaction', () => {
  const source = readFileSync('app/actions/session-actions.ts', 'utf8')
  const start = source.indexOf('export async function createSession(')
  const end = source.indexOf('export async function updateSession(', start)
  assert.ok(start >= 0 && end > start, 'Both canonical Session Actions must exist')

  const create = source.slice(start, end)
  assert.match(create, /parseSessionPrescriptions\(formData\)/,
    'Create must retain the existing validated Coach parser')
  assert.match(create, /validatePrescriptionReferences\(/,
    'Existing server-owned Team, microcycle and date scope guard must remain')
  assert.match(create, /db\.transaction\(\(tx\) => \{/,
    'Session and its prescriptions must be written atomically')
  assert.match(create, /tx\.insert\(groupSessionPrescriptions\)/,
    'Write must reach the existing canonical group prescription table')
  assert.match(create, /primaryObjective:\s*prescription\.primaryObjective\s*\?\?\s*null/,
    'Create must persist the explicitly parsed objective, with null for legacy')
  assert.match(create, /verticalBlockJson:\s*writeVerticalBlockJson\(prescription\.verticalBlock\s*\?\?\s*null\)/,
    'Create must serialize valid verticalBlock v1 into the DB JSON column, not spread an unknown property')
  assert.doesNotMatch(create, /elevationGain:\s*.*\+.*vertical/,
    'Vertical subtotal must not be added to whole-session D+')
})
