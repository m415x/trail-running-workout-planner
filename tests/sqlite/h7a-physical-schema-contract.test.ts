import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

import { auditH7aPhysicalSchema } from '@/scripts/h7a-physical-schema'

const economicTables = [
  'team_economic_policies',
  'athlete_billing_terms',
  'global_monthly_due_date_exceptions',
  'monthly_charge_reductions',
  'monthly_charge_extensions',
  'payment_revisions',
] as const

function fixture(options: { omitTermsAuthor?: boolean; eventDelete?: 'RESTRICT' | 'SET NULL' } = {}) {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec('CREATE TABLE users (id TEXT PRIMARY KEY)')
  db.exec('CREATE TABLE teams (id TEXT PRIMARY KEY)')
  db.exec('CREATE TABLE athlete_groups (id TEXT PRIMARY KEY)')
  for (const table of economicTables) {
    const author = table === 'athlete_billing_terms' && options.omitTermsAuthor
      ? ''
      : ', created_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT'
    db.exec(`CREATE TABLE "${table}" (id TEXT PRIMARY KEY${author})`)
  }
  db.exec('CREATE TABLE field_performance_tests (id TEXT PRIMARY KEY, reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT)')
  db.exec(`CREATE TABLE field_performance_test_events (
    id TEXT PRIMARY KEY NOT NULL, is_deleted INTEGER DEFAULT false NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,\n    group_id TEXT NOT NULL REFERENCES athlete_groups(id) ON DELETE RESTRICT,\n    scheduled_at TEXT NOT NULL,
    protocol TEXT NOT NULL, created_by_user_id TEXT REFERENCES users(id) ON DELETE ${options.eventDelete ?? 'RESTRICT'},
    CONSTRAINT field_performance_test_events_protocol_check CHECK (protocol = '1000m_track')
  )`)
  db.exec('CREATE INDEX field_performance_test_events_team_group_date_idx ON field_performance_test_events(team_id, group_id, scheduled_at)')
  return db
}

test('KAN-773/S1 canonical H7A physical contract accepts all eight author columns and event constraints', () => {
  const db = fixture()
  try {
    assert.deepEqual(auditH7aPhysicalSchema(db), [])
  } finally {
    db.close()
  }
})

test('KAN-773/S1 reports the exact absent 0021 author column without mutating data', () => {
  const db = fixture({ omitTermsAuthor: true })
  try {
    const before = db.serialize().toString('hex')
    assert.match(auditH7aPhysicalSchema(db).join('\n'), /athlete_billing_terms\.created_by_user_id/)
    assert.equal(db.serialize().toString('hex'), before)
  } finally {
    db.close()
  }
})

test('KAN-773/S1 rejects 0025 SET NULL instead of canonical RESTRICT and a missing economic table', () => {
  const db = fixture({ eventDelete: 'SET NULL' })
  try {
    db.exec('DROP TABLE monthly_charge_extensions')
    const diagnostics = auditH7aPhysicalSchema(db).join('\n')
    assert.match(diagnostics, /field_performance_test_events\.created_by_user_id.*RESTRICT/)
    assert.match(diagnostics, /monthly_charge_extensions/)
  } finally {
    db.close()
  }
})

test('KAN-773/S1 rejects a missing protocol CHECK rather than silently accepting any event table', () => {
  const db = fixture()
  try {
    db.exec('ALTER TABLE field_performance_test_events RENAME TO __event_checked')
    db.exec('CREATE TABLE field_performance_test_events (id TEXT PRIMARY KEY, protocol TEXT NOT NULL, created_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT)')
    assert.match(auditH7aPhysicalSchema(db).join('\\n'), /missing protocol CHECK/)
  } finally { db.close() }
})
