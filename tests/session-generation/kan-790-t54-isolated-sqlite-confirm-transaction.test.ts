import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createReviewSnapshotReconciliationPersist } from '@/lib/session-generation/review-snapshot-confirm-reconciliation'
import type { ReviewSnapshotRecord } from '@/lib/session-generation/review-snapshot-sqlite-repository'

const snapshot = {
  id: 'snapshot-isolated',
  userId: 'coach',
  teamId: 'team-a',
  groupTrainingPlanId: 'plan-a',
  groupId: 'group-a',
  planningCohortId: null,
  schemaVersion: '1',
  generatorVersion: '1',
  proposal: { events: [] },
  generationExplanations: {},
  sourceManifest: { version: '1' },
  createdAt: '2026-10-14T18:00:00.000Z',
  expiresAt: '2026-10-14T18:15:00.000Z',
  status: 'active' as const,
  consumedAt: null,
  resultReference: null,
} satisfies ReviewSnapshotRecord

test('KAN-790 T5.4 adapter actually uses injected connection rather than singleton', () => {
  const adapter = readFileSync('lib/session-generation/review-snapshot-confirm-reconciliation.ts', 'utf8')
  const writer = readFileSync('lib/session-generation/review-snapshot-reconciliation-writer.ts', 'utf8')
  assert.match(adapter, /dependencies[.]sqlite[.]inTransaction/)
  assert.match(adapter, /database:\s*dependencies[.]database/)
  assert.match(adapter, /sqlite:\s*dependencies[.]sqlite/)
  assert.doesNotMatch(writer, /database\s*!==\s*db|input[.]sqlite\s*!==\s*sqliteConnection/)
})

test('KAN-790 T5.4 an isolated SQLite connection, not process-global db, owns reconciliation CAS', () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec('CREATE TABLE rollback_probe (id TEXT PRIMARY KEY)')
    const database = drizzle(sqlite)
    const persist = createReviewSnapshotReconciliationPersist({
      database,
      sqlite,
      authorizedGroupIds: new Set(['group-a']),
      now: () => '2026-10-14T18:01:00.000Z',
    })
    assert.throws(() => persist(snapshot), /confirmation transaction missing/)
    assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM rollback_probe').get() as { n: number }).n, 0)
  } finally { sqlite.close() }
})

test('KAN-790 T5.4 isolated CAS rolls back a writer failure without committing marker', () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec('CREATE TABLE rollback_probe (id TEXT PRIMARY KEY)')
    const database = drizzle(sqlite)
    const persist = createReviewSnapshotReconciliationPersist({
      database,
      sqlite,
      authorizedGroupIds: new Set(['group-a']),
      now: () => '2026-10-14T18:01:00.000Z',
    })
    const transaction = sqlite.transaction(() => {
      sqlite.prepare('INSERT INTO rollback_probe (id) VALUES (?)').run('cas-in-progress')
      persist(snapshot)
    })
    assert.throws(() => transaction.immediate(), /no such table: group_training_plans/i)
    assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM rollback_probe').get() as { n: number }).n, 0)
    assert.equal(sqlite.inTransaction, false)
  } finally { sqlite.close() }
})
