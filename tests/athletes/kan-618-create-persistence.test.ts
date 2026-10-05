import assert from 'node:assert/strict'
import test from 'node:test'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as schema from '../../db/schema'
import { createAthleteAdministration } from '../../lib/athletes/create-athlete-administration'

function fixture() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE athlete_profiles (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      user_id TEXT,
      team_id TEXT NOT NULL,
      group_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      first_name TEXT,
      last_name TEXT,
      contact_email TEXT,
      nick_name TEXT,
      dni TEXT NOT NULL,
      birthday TEXT,
      phone TEXT,
      emergency_contact TEXT,
      emergency_phone TEXT,
      physiology TEXT,
      medical TEXT
    );
  `)

  return { sqlite, db: drizzle(sqlite, { schema }) }
}

const input = {
  athleteId: 'athlete-new',
  teamId: 'team_1',
  firstName: 'Ana',
  lastName: 'Acosta',
  contactEmail: 'ana@example.test',
  dni: '30111222',
  nickName: null,
  birthday: null,
  phone: null,
  emergencyContact: null,
  emergencyPhone: null,
  createdAt: '2026-10-05T12:00:00.000Z',
}

test('KAN-618 creates an unlinked AthleteProfile and commits billing in the same transaction', () => {
  const { sqlite, db } = fixture()

  try {
    let billingCalls = 0
    createAthleteAdministration(db, input, () => {
      billingCalls += 1
    })

    const athlete = sqlite.prepare(`
      SELECT user_id, first_name, last_name, contact_email, dni
      FROM athlete_profiles
      WHERE id = ?
    `).get(input.athleteId)

    assert.deepEqual(athlete, {
      user_id: null,
      first_name: 'Ana',
      last_name: 'Acosta',
      contact_email: 'ana@example.test',
      dni: '30111222',
    })
    assert.equal(billingCalls, 1)
  } finally {
    sqlite.close()
  }
})

test('KAN-618 rolls back AthleteProfile when economic initialization fails', () => {
  const { sqlite, db } = fixture()

  try {
    assert.throws(
      () => createAthleteAdministration(db, input, () => {
        throw new Error('economic initialization failed')
      }),
      /economic initialization failed/,
    )

    const athlete = sqlite.prepare(
      'SELECT id FROM athlete_profiles WHERE id = ?',
    ).get(input.athleteId)

    assert.equal(athlete, undefined)
  } finally {
    sqlite.close()
  }
})
