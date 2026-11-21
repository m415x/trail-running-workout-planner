import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('KAN-879 RED-4 updateSession resolves and persists vertical fields by Session + microcycle, including audit', () => {
  const source = readFileSync('app/actions/session-actions.ts', 'utf8')
  const start = source.indexOf('export async function updateSession(')
  const end = source.indexOf('function validatePrescriptionReferences(', start)
  assert.ok(start >= 0 && end > start, 'Canonical updateSession action must exist')
  const update = source.slice(start, end)

  assert.match(source, /import \{ resolveVerticalPrescriptionEditFields \} from ['"]@\/lib\/sessions\/session-vertical-edit-fields['"]/,
    'Action must import the approved T3 preservation resolver')
  assert.match(update, /executeAuthorizedSessionMutation\([\s\S]*?mutate:\s*\(\)\s*=>\s*db\.transaction/,
    'Authorization and the existing SQLite transaction boundary must remain')
  assert.match(update, /previousPrescription\s*=\s*existingPrescriptions\.find\([\s\S]*?existing\.microcycleId\s*===\s*prescription\.microcycleId/,
    'Existing vertical values must be scoped to the exact Session + microcycle')
  assert.match(update, /const verticalFields = resolveVerticalPrescriptionEditFields\(\{[\s\S]*?previous:\s*previousPrescription\s*\?\?\s*null,[\s\S]*?primaryObjective:\s*prescription\.primaryObjective,[\s\S]*?verticalBlock:\s*prescription\.verticalBlock/,
    'Omitted vertical input must preserve the existing row; explicit clear remains distinct')
  assert.match(update, /tx\.insert\(groupSessionPrescriptions\)[\s\S]*?\.onConflictDoUpdate\([\s\S]*?\.\.\.verticalFields/,
    'The resolved vertical values must reach the INSERT and UPDATE paths of the same upsert')
  assert.match(update, /newValue:\s*JSON\.stringify\(\{[\s\S]*?\.\.\.verticalFields/,
    'Audit newValue must describe the effective persisted vertical fields, not dropped parser data')
})
