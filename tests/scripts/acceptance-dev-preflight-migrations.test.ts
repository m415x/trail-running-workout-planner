import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

import { preflightAcceptanceSqlite } from '@/scripts/acceptance-dev-preflight'

const projectRoot = resolve(import.meta.dirname, '../..')

test('KAN-885/T2 integrated preflight rejects missing migration metadata after valid minimal physical schema', () => {
  const directory = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  const databasePath = join(directory, 'acceptance.db')
  try {
    const setup = new Database(databasePath)
    try {
      setup.exec(`
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
    } finally {
      setup.close()
    }

    const before = readFileSync(databasePath)
    assert.throws(
      () => preflightAcceptanceSqlite({ databasePath, projectRoot }),
      /migration|metadata|journal|missing|absent|migraci[oó]n/i,
    )
    assert.deepEqual(readFileSync(databasePath), before)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
