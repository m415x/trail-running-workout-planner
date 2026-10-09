import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

import { resolvePersistedSelfSessionLink } from '@/lib/athlete-planning/persisted-self-session-link'

test('KAN-700 persisted session locator rejects same-Team prescription belonging to another session', () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE sessions (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, date TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE group_session_prescriptions (
        id TEXT PRIMARY KEY, session_id TEXT NOT NULL, group_id TEXT NOT NULL,
        group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO sessions VALUES ('session-a', 'team-a', '2026-10-09', 0);
      INSERT INTO sessions VALUES ('session-b', 'team-a', '2026-10-09', 0);
      INSERT INTO group_session_prescriptions VALUES ('prescription-b', 'session-b', 'group-a', 'plan-a', 0);
    `)
    const lookup = (sessionId: string) => ({
      session: sqlite.prepare('SELECT id, team_id AS teamId, date, is_deleted AS isDeleted FROM sessions WHERE id = ?').get(sessionId) as
        { id: string; teamId: string; date: string; isDeleted: number } | undefined,
      prescriptions: sqlite.prepare('SELECT id, session_id AS sessionId, group_id AS groupId, group_training_plan_id AS groupTrainingPlanId FROM group_session_prescriptions WHERE is_deleted = 0').all() as
        Array<{ id: string; sessionId: string; groupId: string; groupTrainingPlanId: string }>,
    })
    const result = resolvePersistedSelfSessionLink({
      athleteProfileId: 'athlete-a', athleteTeamId: 'team-a',
      currentGroupId: 'group-a', groupChanges: [], memberships: [],
      basePlans: [{
        id: 'plan-a', groupId: 'group-a', planningCohortId: null, status: 'active', isDeleted: false,
        macrocycles: [{ startDate: '2026-10-01', endDate: '2026-10-31', isDeleted: false }],
      }],
      sessionId: 'session-a',
      load: lookup,
    })
    assert.deepEqual(result, { status: 'denied' })
  } finally {
    sqlite.close()
  }
})

test('KAN-700 persisted session locator accepts matching effective session and rejects cross-Team', () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE sessions (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, date TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE group_session_prescriptions (
        id TEXT PRIMARY KEY, session_id TEXT NOT NULL, group_id TEXT NOT NULL,
        group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO sessions VALUES ('session-a', 'team-a', '2026-10-09', 0);
      INSERT INTO group_session_prescriptions VALUES ('prescription-a', 'session-a', 'group-a', 'plan-a', 0);
    `)
    const load = (sessionId: string) => ({
      session: sqlite.prepare('SELECT id, team_id AS teamId, date, is_deleted AS isDeleted FROM sessions WHERE id = ?').get(sessionId) as
        { id: string; teamId: string; date: string; isDeleted: number } | undefined,
      prescriptions: sqlite.prepare('SELECT id, session_id AS sessionId, group_id AS groupId, group_training_plan_id AS groupTrainingPlanId FROM group_session_prescriptions WHERE is_deleted = 0').all() as
        Array<{ id: string; sessionId: string; groupId: string; groupTrainingPlanId: string }>,
    })
    const input = {
      athleteProfileId: 'athlete-a', athleteTeamId: 'team-a',
      currentGroupId: 'group-a', groupChanges: [], memberships: [],
      basePlans: [{
        id: 'plan-a', groupId: 'group-a', planningCohortId: null, status: 'active' as const, isDeleted: false,
        macrocycles: [{ startDate: '2026-10-01', endDate: '2026-10-31', isDeleted: false }],
      }],
      sessionId: 'session-a', load,
    }
    assert.deepEqual(resolvePersistedSelfSessionLink(input), {
      status: 'resolved', athleteProfileId: 'athlete-a', sessionId: 'session-a', prescriptionId: 'prescription-a',
    })
    assert.deepEqual(resolvePersistedSelfSessionLink({ ...input, athleteTeamId: 'team-b' }), { status: 'denied' })
  } finally {
    sqlite.close()
  }
})
