import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as schema from '@/db/schema'
import { createAuthorizedCompetitionCalendarWriter } from '@/lib/periodization/authorized-competition-calendar-writer'
import { runAuthorizedCompetitionMutation } from '@/lib/periodization/authorized-competition-calendar-mutation'

test('KAN-830 T4: SQLite multi-Team ownership, capability and DENY do not mutate any durable rows', async () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE competition_entries (id TEXT PRIMARY KEY NOT NULL, group_training_plan_id TEXT NOT NULL, status TEXT NOT NULL);
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

    // Integrate actual SQLite ownership decision with the production mutation dispatcher.
    // All rejected decisions must stop before a SQL writer is called.
    const entrySnapshot = () => sqlite.prepare('SELECT * FROM competition_entries ORDER BY id').all()
    let dispatchedWrites = 0
    const dispatch = (planId: string, entryId: string) => runAuthorizedCompetitionMutation({
      authorize: async () => {
        const decision = await writer.authorizePlan(planId)
        return decision.status === 'allowed' ? { planId, teamId: decision.teamId } : null
      },
      onDenied: (): { ok: boolean } => ({ ok: false }),
      write: ({ planId: authorizedPlanId }) => {
        dispatchedWrites++
        sqlite.prepare('INSERT INTO competition_entries (id, group_training_plan_id, status) VALUES (?, ?, ?)').run(entryId, authorizedPlanId, 'planned')
        return { ok: true }
      },
    })
    const emptyEntries = entrySnapshot()
    currentTeam = 'team_a'
    permitted = false
    assert.deepEqual(await dispatch('plan_a', 'denied_capability'), { ok: false })
    permitted = true
    assert.deepEqual(await dispatch('plan_b', 'denied_foreign_team'), { ok: false })
    assert.deepEqual(await dispatch('plan_deleted', 'denied_deleted_plan'), { ok: false })
    assert.equal(dispatchedWrites, 0)
    assert.deepEqual(entrySnapshot(), emptyEntries)
    currentTeam = 'team_b'
    assert.deepEqual(await dispatch('plan_b', 'allowed_team_b'), { ok: true })
    assert.equal(dispatchedWrites, 1)
    assert.deepEqual(entrySnapshot(), [{ id: 'allowed_team_b', group_training_plan_id: 'plan_b', status: 'planned' }])

    // ALLOW legitimately increments total_changes(). Use the post-ALLOW
    // baseline to prove that the subsequent anonymous DENY adds no writes.
    const afterAllowed = snapshot()
    const entriesAfterAllowed = entrySnapshot()
    access = { status: 'anonymous' }
    assert.deepEqual(await writer.authorizePlan('plan_b'), { status: 'denied' })
    assert.deepEqual(snapshot(), afterAllowed)
    assert.deepEqual(entrySnapshot(), entriesAfterAllowed)
    assert.equal(dispatchedWrites, 1)
  } finally {
    sqlite.close()
  }
})
