import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

import { inspectH7aMigrationGuard } from '@/scripts/h7a-metadata-drift-guard'

const journal = JSON.parse(readFileSync('drizzle/sqlite/meta/_journal.json', 'utf8')) as {
  entries: Array<{ tag: string; when: number }>
}
const entries = journal.entries.filter(entry => /^002[0-5]_h7a_/.test(entry.tag))

function fixture() {
  const db = new Database(':memory:')
  db.exec('CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created_at NUMERIC)')
  db.exec('CREATE TABLE users (id TEXT PRIMARY KEY)')
  db.exec('CREATE TABLE teams (id TEXT PRIMARY KEY)')
  db.exec('CREATE TABLE athlete_groups (id TEXT PRIMARY KEY)')
  const economic = [
    'team_economic_policies', 'athlete_billing_terms',
    'global_monthly_due_date_exceptions', 'monthly_charge_reductions',
    'monthly_charge_extensions', 'payment_revisions',
  ]
  for (const table of economic) db.exec(`CREATE TABLE "${table}" (id TEXT PRIMARY KEY, created_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT)`)
  db.exec('CREATE TABLE field_performance_tests (id TEXT PRIMARY KEY, reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT)')
  db.exec(`CREATE TABLE field_performance_test_events (
    id TEXT PRIMARY KEY NOT NULL, is_deleted INTEGER DEFAULT false NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL REFERENCES athlete_groups(id) ON DELETE RESTRICT,
    scheduled_at TEXT NOT NULL, protocol TEXT NOT NULL,
    created_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
    CHECK (protocol = '1000m_track')
  )`)
  db.exec('CREATE INDEX field_performance_test_events_team_group_date_idx ON field_performance_test_events(team_id,group_id,scheduled_at)')
  const insert = db.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')
  for (const entry of entries) {
    const sql = readFileSync(`drizzle/sqlite/${entry.tag}.sql`, 'utf8')
    insert.run(createHash('sha256').update(sql).digest('hex'), entry.when)
  }
  return db
}

test('KAN-774/S2 canonical applied H7A passes physical and full-hash guard without writes', () => {
  const db = fixture()
  try {
    const before = db.serialize().toString('hex')
    assert.deepEqual(inspectH7aMigrationGuard(db), [])
    assert.equal(db.serialize().toString('hex'), before)
  } finally { db.close() }
})

test('KAN-774/S2 rejects registered 0021 with absent physical column before metadata changes', () => {
  const db = fixture()
  try {
    db.exec('ALTER TABLE athlete_billing_terms RENAME TO __old_terms')
    db.exec('CREATE TABLE athlete_billing_terms (id TEXT PRIMARY KEY)')
    db.exec('DROP TABLE __old_terms')
    const before = db.serialize().toString('hex')
    assert.match(inspectH7aMigrationGuard(db).join('\n'), /athlete_billing_terms\.created_by_user_id/)
    assert.equal(db.serialize().toString('hex'), before)
  } finally { db.close() }
})

test('KAN-774/S2 rejects tampered applied full hash even with a physically compatible schema', () => {
  const db = fixture()
  try {
    db.prepare('UPDATE __drizzle_migrations SET hash = ? WHERE created_at = ?').run('bad-hash', entries[1].when)
    const before = db.serialize().toString('hex')
    assert.match(inspectH7aMigrationGuard(db).join('\n'), /0021.*hash/i)
    assert.equal(db.serialize().toString('hex'), before)
  } finally { db.close() }
})
