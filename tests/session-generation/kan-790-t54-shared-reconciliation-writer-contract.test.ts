import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const root = process.cwd()
const action = readFileSync(root + '/app/actions/session-generation-actions.ts', 'utf8')
const confirmation = readFileSync(root + '/lib/session-generation/authorized-review-snapshot-confirmation.ts', 'utf8')

test('KAN-790 T5.4 production legacy Action and SQL CONFIRM share one reconciliation writer', () => {
  const writer = readFileSync(root + '/lib/session-generation/review-snapshot-reconciliation-writer.ts', 'utf8')

  assert.match(writer, /export function reconcileAndPersistGeneratedSessionsSqlite\s*\(/)
  assert.doesNotMatch(action, /reconcileAndPersistGeneratedSessionsSqlite\s*\(/)
  const pgAction = readFileSync(root + '/app/actions/coach-session-review-snapshot-actions.ts', 'utf8')
  const pgConfirmation = readFileSync(root + '/lib/session-generation/authorized-review-snapshot-postgres-confirmation.ts', 'utf8')
  const pgWriter = readFileSync(root + '/lib/session-generation/review-snapshot-reconciliation-writer-postgres.ts', 'utf8')
  assert.match(pgAction, /createAuthorizedReviewSnapshotPostgresSessionOperations/)
  assert.match(pgConfirmation, /dependencies\.persist\(tx, snapshot\)/)
  // PostgreSQL reconciliation is a transactional SQL implementation, not a
  // direct invocation of the SQLite/domain reconciliation function.
  assert.match(pgWriter, /export async function reconcileAndPersistGeneratedSessionsPostgres/)
  assert.match(pgWriter, /authorizedGroupIds\.has/)
  assert.match(pgWriter, /generation_ownership/)
  assert.match(pgWriter, /group_session_prescriptions/)
  assert.match(pgWriter, /session_generation_modification_records/)
  assert.match(writer, /reconcileSessionGeneration\s*\(/)
  assert.match(writer, /sessionGenerationModificationRecords/)
  assert.match(writer, /groupSessionPrescriptions/)
  assert.match(writer, /generationExplanation/)
  assert.match(confirmation, /consumeReviewSnapshotSqlite\s*\(/)
})

test('KAN-790 T5.4 reconciliation read-set and writes live in the same synchronous transaction', () => {
  const writer = readFileSync(root + '/lib/session-generation/review-snapshot-reconciliation-writer.ts', 'utf8')
  assert.match(writer, /\.transaction\s*\(/)
  assert.match(writer, /reconcileSessionGeneration\s*\(/)
  const body = writer.slice(writer.indexOf('const run ='), writer.indexOf('return input.withinExistingTransaction'))
  assert.match(writer, /database[.]transaction[(]run[)]/)
  assert.match(body, /tx[.]select/)
  assert.match(body, /reconcileSessionGeneration/)
  assert.match(body, /groupSessionPrescriptions/)
  assert.match(body, /sessionGenerationModificationRecords/)
  assert.ok(!body.includes('await '))
})

test('KAN-790 T5.4 legacy client proposal parsing never becomes authority in snapshot confirm', () => {
  const writer = readFileSync(root + '/lib/session-generation/review-snapshot-reconciliation-writer.ts', 'utf8')
  assert.doesNotMatch(writer, /FormData|formData\.get\s*\(/)
  assert.doesNotMatch(confirmation, /formData\.get\s*\(|JSON\.parse\(.*proposal/)
  assert.match(confirmation, /dependencies\.persist\(snapshot\)/)
})
