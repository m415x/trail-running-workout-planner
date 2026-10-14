import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const root = process.cwd()
const action = readFileSync(root + '/app/actions/session-generation-actions.ts', 'utf8')
const confirmation = readFileSync(root + '/lib/session-generation/authorized-review-snapshot-confirmation.ts', 'utf8')

test('KAN-790 T5.4 production legacy Action and SQL CONFIRM share one reconciliation writer', () => {
  const writer = readFileSync(root + '/lib/session-generation/review-snapshot-reconciliation-writer.ts', 'utf8')

  assert.match(writer, /export function reconcileAndPersistGeneratedSessionsSqlite\s*\(/)
  assert.match(action, /reconcileAndPersistGeneratedSessionsSqlite\s*\(/)
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
  const transaction = writer.slice(writer.indexOf('.transaction('))
  assert.match(transaction, /reconcileSessionGeneration\s*\(/)
  assert.match(transaction, /groupSessionPrescriptions/)
  assert.match(transaction, /sessionGenerationModificationRecords/)
  assert.doesNotMatch(transaction, /\bawait\b/)
})

test('KAN-790 T5.4 legacy client proposal parsing never becomes authority in snapshot confirm', () => {
  const writer = readFileSync(root + '/lib/session-generation/review-snapshot-reconciliation-writer.ts', 'utf8')
  assert.doesNotMatch(writer, /FormData|formData\.get\s*\(/)
  assert.doesNotMatch(confirmation, /formData\.get\s*\(|JSON\.parse\(.*proposal/)
  assert.match(confirmation, /dependencies\.persist\(snapshot\)/)
})
