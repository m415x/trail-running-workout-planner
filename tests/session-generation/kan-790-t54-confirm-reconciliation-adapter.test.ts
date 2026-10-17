import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(
  'lib/session-generation/review-snapshot-confirm-reconciliation.ts',
  'utf8',
)

test('KAN-790 T5.4 CONFIRM has one server-owned snapshot-to-reconciliation adapter', () => {
  assert.match(source, /export function createReviewSnapshotReconciliationPersist\s*\(/)
  assert.match(source, /reconcileAndPersistGeneratedSessionsSqlite\s*\(/)
  assert.match(source, /snapshot\.proposal/)
  assert.match(source, /snapshot\.generationExplanations/)
  assert.match(source, /snapshot\.groupTrainingPlanId/)
  assert.match(source, /snapshot\.teamId/)
  assert.match(source, /snapshot\.userId/)
  assert.doesNotMatch(source, /FormData|formData\.get\s*\(/)
})

test('KAN-790 T5.4 adapter proves canonical connection and shares active CAS transaction', () => {
  assert.match(source, /dependencies[.]sqlite[.]inTransaction/)
  assert.match(source, /withinExistingTransaction:\s*true/)
  assert.match(source, /sqlite:\s*dependencies[.]sqlite/)
  assert.match(source, /database:\s*dependencies[.]database/)
  assert.match(source, /authorizedGroupIds/)
  assert.match(source, /resultReference/)
})

test('KAN-790 T5.4 adapter never writes Sessions independently of the shared writer', () => {
  assert.doesNotMatch(source, /insert\(sessions\)|update\(sessions\)/)
  assert.doesNotMatch(source, /insert\(groupSessionPrescriptions\)/)
  assert.doesNotMatch(source, /\.transaction\s*\(/)
})
