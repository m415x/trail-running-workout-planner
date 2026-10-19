import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { classifyH7aSqliteState } from '@/scripts/h7a-recovery-classification'

const entries = (JSON.parse(readFileSync('drizzle/sqlite/meta/_journal.json', 'utf8')) as {
  entries: Array<{ tag: string; when: number }>
}).entries.filter(entry => /^002[0-5]_h7a_/.test(entry.tag))

function fixture(count = 6, missing = false) {
  const db = new Database(':memory:')
  db.exec('CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)')
  db.exec('CREATE TABLE users (id TEXT PRIMARY KEY)')
  db.exec('CREATE TABLE teams (id TEXT PRIMARY KEY)')
  db.exec('CREATE TABLE athlete_groups (id TEXT PRIMARY KEY)')
  for (const name of ['team_economic_policies','athlete_billing_terms','global_monthly_due_date_exceptions','monthly_charge_reductions','monthly_charge_extensions','payment_revisions']) {
    db.exec(`CREATE TABLE "${name}" (id TEXT PRIMARY KEY${missing && name === 'athlete_billing_terms' ? '' : ', created_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT'})`)
  }
  db.exec('CREATE TABLE field_performance_tests (id TEXT PRIMARY KEY, reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT)')
  db.exec(`CREATE TABLE field_performance_test_events (
    id TEXT PRIMARY KEY NOT NULL, is_deleted INTEGER DEFAULT false NOT NULL, created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL, team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL REFERENCES athlete_groups(id) ON DELETE RESTRICT,
    scheduled_at TEXT NOT NULL, protocol TEXT NOT NULL,
    created_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
    CHECK (protocol = '1000m_track')
  )`)
  db.exec('CREATE INDEX field_performance_test_events_team_group_date_idx ON field_performance_test_events(team_id,group_id,scheduled_at)')
  const insert = db.prepare('INSERT INTO __drizzle_migrations(hash,created_at) VALUES (?,?)')
  for (const entry of entries.slice(0,count)) insert.run(createHash('sha256').update(readFileSync(`drizzle/sqlite/${entry.tag}.sql`)).digest('hex'),entry.when)
  return db
}

test('KAN-775/S3 classifies fully applied canonical H7A without mutations', () => {
  const db = fixture()
  try {
    const before = db.serialize().toString('hex')
    assert.equal(classifyH7aSqliteState(db).status, 'canonical')
    assert.equal(db.serialize().toString('hex'), before)
  } finally { db.close() }
})

test('KAN-775/S3 refuses to label physical HEAD with missing metadata as legitimate pending', () => {
  const db = fixture(3)
  try { assert.equal(classifyH7aSqliteState(db).status, 'incompatible') }
  finally { db.close() }
})

test('KAN-775/S3 detects recorded 0021 missing its physical author', () => {
  const db = fixture(6, true)
  try {
    const result = classifyH7aSqliteState(db)
    assert.equal(result.status, 'registered_drift')
    assert.match(result.reasons.join('\n'), /athlete_billing_terms\.created_by_user_id/)
  } finally { db.close() }
})

test('KAN-775/S3 rejects corrupted canonical hash', () => {
  const db = fixture()
  try {
    db.prepare('UPDATE __drizzle_migrations SET hash = ? WHERE created_at = ?').run('invalid',entries[1].when)
    assert.equal(classifyH7aSqliteState(db).status, 'incompatible')
  } finally { db.close() }
})

test('KAN-775/S3 rejects absent baseline and remains read-only', () => {
  const db = new Database(':memory:')
  try {
    db.exec('CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)')
    const before = db.serialize().toString('hex')
    const result = classifyH7aSqliteState(db)
    assert.equal(result.status, 'incompatible')
    assert.ok(result.reasons.length > 0)
    assert.equal(db.serialize().toString('hex'),before)
  } finally { db.close() }
})
