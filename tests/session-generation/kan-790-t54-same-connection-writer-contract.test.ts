import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const writer = readFileSync('lib/session-generation/review-snapshot-reconciliation-writer.ts', 'utf8')
const confirmation = readFileSync('lib/session-generation/authorized-review-snapshot-confirmation.ts', 'utf8')

test('KAN-790 T5.4 shared writer has explicit SQLite/Drizzle connection ownership', () => {
  assert.match(writer, /database:\s*SharedDrizzleDatabase/)
  assert.doesNotMatch(writer, /run\(db as unknown as/)
  assert.match(writer, /input\.database|database\.transaction/)
})

test('KAN-790 T5.4 confirmation uses one SQLite connection for CAS and reconciliation', () => {
  assert.match(confirmation, /consumeReviewSnapshotSqlite/)
  assert.match(confirmation, /dependencies\.sqlite/)
  assert.match(confirmation, /dependencies\.persist\(snapshot\)/)
})
