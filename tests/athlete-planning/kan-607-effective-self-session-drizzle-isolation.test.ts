import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { eq } from 'drizzle-orm'

import { loadEffectiveSessionLocatorFromDatabase } from '@/lib/athlete-planning/effective-self-session-next-server'

const athleteRows = sqliteTable('athlete_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  teamId: text('team_id').notNull(),
  isDeleted: integer('is_deleted').notNull(),
  isActive: integer('is_active').notNull(),
})
const sessionRows = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  teamId: text('team_id').notNull(),
  date: text('date').notNull(),
  isDeleted: integer('is_deleted').notNull(),
})
const prescriptionRows = sqliteTable('group_session_prescriptions', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  groupId: text('group_id').notNull(),
  microcycleId: text('microcycle_id').notNull(),
  isDeleted: integer('is_deleted').notNull(),
})

test('KAN-700 persisted Drizzle locator reads only the authorized AthleteProfile, Team and session', async () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE athlete_profiles (id TEXT PRIMARY KEY,user_id TEXT,team_id TEXT NOT NULL,is_deleted INTEGER NOT NULL,is_active INTEGER NOT NULL);
      CREATE TABLE sessions (id TEXT PRIMARY KEY,team_id TEXT NOT NULL,date TEXT NOT NULL,is_deleted INTEGER NOT NULL);
      CREATE TABLE group_session_prescriptions (id TEXT PRIMARY KEY,session_id TEXT NOT NULL,group_id TEXT NOT NULL,microcycle_id TEXT NOT NULL,is_deleted INTEGER NOT NULL);
      INSERT INTO athlete_profiles VALUES ('athlete-a','user-a','team-a',0,1),('athlete-b','user-b','team-a',0,1);
      INSERT INTO sessions VALUES ('session-a','team-a','2026-10-09',0),('session-b','team-a','2026-10-09',0),('session-c','team-b','2026-10-09',0);
      INSERT INTO group_session_prescriptions VALUES ('prescription-a','session-a','group-a','micro-a',0),
        ('prescription-b','session-b','group-b','micro-b',0),('prescription-c','session-c','group-a','micro-c',0);
    `)
    const db = drizzle(sqlite, { schema: { athleteRows, sessionRows, prescriptionRows } })
    const lookup = async (userId: string, teamId: string, athleteProfileId: string, sessionId: string) => {
      const [athlete] = await db.select().from(athleteRows).where(eq(athleteRows.id, athleteProfileId))
      const [session] = await db.select().from(sessionRows).where(eq(sessionRows.id, sessionId))
      const prescriptions = await db.select().from(prescriptionRows).where(eq(prescriptionRows.sessionId, sessionId))
      return loadEffectiveSessionLocatorFromDatabase({
        self: { userId, teamId, athleteProfileId },
        athlete: athlete ?? null,
        session: session ?? null,
        prescriptions,
      })
    }

    const own = await lookup('user-a', 'team-a', 'athlete-a', 'session-a')
    assert.equal(own.status, 'resolved')
    if (own.status === 'resolved') {
      assert.deepEqual(own.prescriptions.map(p => p.id), ['prescription-a'])
    }
    assert.deepEqual(await lookup('user-a', 'team-a', 'athlete-b', 'session-b'), { status: 'denied' })
    assert.deepEqual(await lookup('user-a', 'team-a', 'athlete-a', 'session-c'), { status: 'denied' })
    assert.deepEqual(await lookup('user-a', 'team-b', 'athlete-a', 'session-a'), { status: 'denied' })
  } finally {
    sqlite.close()
  }
})
