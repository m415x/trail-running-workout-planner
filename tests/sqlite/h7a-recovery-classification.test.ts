import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { classifyH7aSqliteState } from '@/scripts/h7a-recovery-classification'

test('KAN-775/S3 rejects partial migration metadata with unproven physical state', () => {
  const db = new Database(':memory:')
  try {
    db.exec('CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)')
    const result = classifyH7aSqliteState(db)
    assert.equal(result.status, 'incompatible')
    assert.ok(result.reasons.length > 0)
  } finally {
    db.close()
  }
})
