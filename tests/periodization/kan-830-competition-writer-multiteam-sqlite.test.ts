import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as schema from '@/db/schema'
import { createAuthorizedCompetitionCalendarWriter } from '@/lib/periodization/authorized-competition-calendar-writer'

test('KAN-830 T4: SQLite multi-Team ownership, capability and DENY do not mutate any durable rows', async () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE athlete_groups (
        id TEXT PRIMARY KEY NOT NULL,
        team_id TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE group_training_plans (
        id TEXT PRIMARY KEY NOT NULL,
        group_id TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO athlete_groups (id, team_id, is_deleted) VALUES
        ('group_a', 'team_a', 0), ('group_b', 'team_b', 0), ('group_deleted', 'team_a', 1);
      INSERT INTO group_training_plans (id, group_id, is_deleted) VALUES
        ('plan_a', 'group_a', 0), ('plan_b', 'group_b', 0),
        ('plan_deleted_group', 'group_deleted', 0), ('plan_deleted', 'group_a', 1);
    `)
    const database = drizzle(sqlite, { schema }) as Parameters<typeof createAuthorizedCompetitionCalendarWriter>[0]['database']
    let currentTeam = 'team_a'
    let permitted = true
    let access: Awaited<ReturnType<Parameters<typeof createAuthorizedCompetitionCalendarWriter>[0]['readAccess']>> = {
      status: 'authenticated', provider: 'supabase', subject: 'coach_subject', userId: 'coach_id',
    }
    const requests: { capability: string; teamId: string; scope: string | undefined }[] = []
    const writer = createAuthorizedCompetitionCalendarWriter({
      database,
      readAccess: async () => access,
      resolveActiveTeam: async () => ({ status: 'resolved', teamId: currentTeam, source: 'persisted' }),
      authorize: async (_identity, request) => {
        requests.push({
          capability: request.capability,
          teamId: request.resource.teamId,
          scope: request.requiredScope,
        })
        return { allowed: permitted, teamId: currentTeam }
      },
      now: () => '2026-10-19T12:00:00.000Z',
    })
    const snapshot = () => ({
      groups: sqlite.prepare('SELECT * FROM athlete_groups ORDER BY id').all(),
      plans: sqlite.prepare('SELECT * FROM group_training_plans ORDER BY id').all(),
      changes: sqlite.prepare('SELECT total_changes() AS count').get(),
    })
    const before = snapshot()

    assert.deepEqual(await writer.authorizePlan('plan_a'), { status: 'allowed', teamId: 'team_a' })
    assert.deepEqual(requests, [{ capability: 'competition.manage', teamId: 'team_a', scope: 'team' }])

    for (const planId of ['plan_b', 'plan_deleted', 'plan_deleted_group', 'missing_plan']) {
      assert.deepEqual(await writer.authorizePlan(planId), { status: 'denied' })
      assert.deepEqual(snapshot(), before)
    }
    assert.equal(requests.length, 1, 'foreign/deleted plans must not reach capability check')

    permitted = false
    assert.deepEqual(await writer.authorizePlan('plan_a'), { status: 'denied' })
    assert.deepEqual(snapshot(), before)

    permitted = true
    currentTeam = 'team_b'
    assert.deepEqual(await writer.authorizePlan('plan_a'), { status: 'denied' })
    assert.deepEqual(await writer.authorizePlan('plan_b'), { status: 'allowed', teamId: 'team_b' })
    assert.deepEqual(snapshot(), before)

    access = { status: 'anonymous' }
    assert.deepEqual(await writer.authorizePlan('plan_b'), { status: 'denied' })
    assert.deepEqual(snapshot(), before)
  } finally {
    sqlite.close()
  }
})
