import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

import { assertAcceptancePhysicalSchema } from '@/scripts/acceptance-dev-physical-schema'

test('KAN-885/T2 rejects schema missing HEAD authorization and physiology domains even if minimal tables exist', () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE users (id TEXT, is_deleted INTEGER, user_name TEXT, email TEXT);
      CREATE TABLE external_identity_links (id TEXT, is_deleted INTEGER, user_id TEXT, provider TEXT, subject TEXT);
      CREATE TABLE teams (id TEXT, is_deleted INTEGER);
      CREATE TABLE team_memberships (id TEXT, is_deleted INTEGER, user_id TEXT, team_id TEXT, preset TEXT, is_active INTEGER, effective_from TEXT, effective_until TEXT);
      CREATE TABLE athlete_profiles (id TEXT, is_deleted INTEGER, user_id TEXT, team_id TEXT);
      CREATE TABLE athlete_groups (id TEXT, is_deleted INTEGER, team_id TEXT);
      CREATE TABLE sessions (id TEXT, is_deleted INTEGER, team_id TEXT, date TEXT, generation_ownership TEXT);
      CREATE TABLE group_session_prescriptions (id TEXT, is_deleted INTEGER, session_id TEXT, group_id TEXT, microcycle_id TEXT, generation_ownership TEXT);
      CREATE TABLE microcycles (id TEXT, is_deleted INTEGER, mesocycle_id TEXT);
    `)
    sqlite.pragma('query_only = ON')
    const before = sqlite.prepare(
      "SELECT name, sql FROM sqlite_schema WHERE type = 'table' ORDER BY name",
    ).all()

    assert.throws(
      () => assertAcceptancePhysicalSchema(sqlite),
      /physical|schema|missing|authorization_grants|field_performance_tests|table/i,
    )
    assert.deepEqual(
      sqlite.prepare("SELECT name, sql FROM sqlite_schema WHERE type = 'table' ORDER BY name").all(),
      before,
    )
  } finally {
    sqlite.close()
  }
})
