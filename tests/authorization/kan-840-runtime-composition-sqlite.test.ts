import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'

import { athleteGroups, groupTrainingPlans, teamMemberships } from '@/db/schema'
import { createH4aAuthorizationAdapter } from '@/lib/authorization/h4a-authorization-adapter'
import { createH4bPlanningAuthorizationBoundary } from '@/lib/authorization/h4b-planning-authorization'
import { createCoachPlanningListOperation } from '@/lib/planning/coach-planning-list-operation'

const NOW = '2026-10-20T12:00:00.000Z'
const source = readFileSync('app/actions/planning-actions.ts', 'utf8')

test('KAN-840/T1.4 Server Action delegates to the same internal runtime operation', () => {
  const start = source.indexOf('export async function getCoachPlanningListResult()')
  const end = source.indexOf('export async function getGroupTrainingPlanById(', start)
  assert.ok(start >= 0 && end > start)
  assert.match(source.slice(start, end), /createCoachPlanningListOperation\(/)
})

test('KAN-840/T1.4 SQLite-backed effective H3/H4A/H4B authorization distinguishes DENY EMPTY READY ERROR', async () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE athlete_groups (
        id TEXT PRIMARY KEY, team_id TEXT NOT NULL, category_code TEXT NOT NULL,
        level_code TEXT NOT NULL, description TEXT, is_active INTEGER NOT NULL DEFAULT 1,
        is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE group_training_plans (
        id TEXT PRIMARY KEY, group_id TEXT NOT NULL,
        planning_cohort_id TEXT, source_group_training_plan_id TEXT,
        title TEXT NOT NULL, status TEXT NOT NULL, notes TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE team_memberships (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, team_id TEXT NOT NULL,
        preset TEXT NOT NULL, effective_from TEXT NOT NULL, effective_until TEXT,
        is_active INTEGER NOT NULL DEFAULT 1, is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `)
    const db = drizzle(sqlite, { schema: { athleteGroups, groupTrainingPlans, teamMemberships } })
    const groups: (typeof athleteGroups.$inferInsert)[] = [
      { id: 'g-allow', teamId: 'team-a', categoryCode: 'M', levelCode: '1', isActive: true, isDeleted: false, createdAt: NOW, updatedAt: NOW },
      { id: 'g-other', teamId: 'team-a', categoryCode: 'S', levelCode: '2', isActive: true, isDeleted: false, createdAt: NOW, updatedAt: NOW },
    ]
    for (const group of groups) db.insert(athleteGroups).values(group).run()
    for (const [id, groupId] of [['p-allow', 'g-allow'], ['p-other', 'g-other']] as const) {
      db.insert(groupTrainingPlans).values({ id, groupId, title: id, status: 'draft', isDeleted: false, createdAt: NOW, updatedAt: NOW }).run()
    }
    for (const [id, preset] of [['athlete-1', 'athlete'], ['coach-1', 'coach'], ['coach-empty', 'coach']] as const) {
      db.insert(teamMemberships).values({
        id: 'membership-'+id, userId: id, teamId: 'team-a', preset,
        effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveUntil: null,
        isActive: true, isDeleted: false, createdAt: NOW, updatedAt: NOW,
      }).run()
    }

    let userId = 'athlete-1'
    let teamStatus: 'resolved' | 'selection_required' | 'invalid_context' = 'resolved'
    let failAfterAuthorization = false
    let planReads = 0
    const snapshot = () => JSON.stringify({
      groups: sqlite.prepare('SELECT * FROM athlete_groups ORDER BY id').all(),
      plans: sqlite.prepare('SELECT * FROM group_training_plans ORDER BY id').all(),
      memberships: sqlite.prepare('SELECT * FROM team_memberships ORDER BY id').all(),
    })

    const h4a = createH4aAuthorizationAdapter({
      async loadMemberships(actor, team) {
        return db.select().from(teamMemberships).where(eq(teamMemberships.userId, actor)).all()
          .filter(row => row.teamId === team)
          .map(row => ({ userId: row.userId, teamId: row.teamId, preset: row.preset as 'coach'|'athlete', effectiveFrom: row.effectiveFrom, effectiveUntil: row.effectiveUntil, isActive: row.isActive }))
      },
      async loadAthleteProfiles() { return [] },
      async loadGrants() { return [] },
    })

    const operation = createCoachPlanningListOperation({
      authenticate: async () => ({ status: 'authenticated' as const, userId }),
      resolveActiveTeam: async () => teamStatus === 'resolved'
        ? { status: 'resolved' as const, teamId: 'team-a', source: 'persisted' as const }
        : { status: teamStatus },
      authorize: async (access, request) => h4a.authorize(access, request),
      listGroups: async teamId => db.select().from(athleteGroups).where(eq(athleteGroups.teamId, teamId)).all(),
      listPlans: async groupIds => {
        planReads++
        if (failAfterAuthorization) throw new Error('controlled SQLite read failure')
        return db.select().from(groupTrainingPlans).all().filter(plan => groupIds.includes(plan.groupId))
          .map(plan => ({ ...plan, teamId: 'team-a', groupId: plan.groupId }))
      },
      authorizePlan: async (access, plan) => {
        const h4b = createH4bPlanningAuthorizationBoundary({
          resolveActiveTeam: async () => ({ status: 'resolved', teamId: 'team-a', source: 'persisted' }),
          loadOwnership: async id => id === plan.id ? { teamId: plan.teamId, sportingGroupIds: [plan.groupId] } : null,
          authorize: (actor, request) => h4a.authorize(actor, request),
        })
        return (await h4b.authorize(access, { resourceId: plan.id, at: NOW })).allowed
      },
      now: () => NOW,
    })

    const before = snapshot()
    assert.deepEqual(await operation.read(), { status: 'denied' })
    assert.equal(planReads, 0)
    assert.equal(snapshot(), before, 'DENY must not mutate persisted SQLite')

    userId = 'coach-1'
    const ready = await operation.read()
    assert.equal(ready.status, 'ready')
    if (ready.status === 'ready') assert.deepEqual(ready.plans.map(plan => plan.id).sort(), ['p-allow', 'p-other'])

    db.delete(groupTrainingPlans).run()
    assert.deepEqual(await operation.read(), { status: 'empty' })

    teamStatus = 'selection_required'
    const readsBeforeAmbiguous = planReads
    assert.deepEqual(await operation.read(), { status: 'denied' })
    assert.equal(planReads, readsBeforeAmbiguous)

    teamStatus = 'resolved'
    db.update(teamMemberships).set({ isActive: false }).where(eq(teamMemberships.userId, 'coach-1')).run()
    assert.deepEqual(await operation.read(), { status: 'denied' })

    db.update(teamMemberships).set({ isActive: true }).where(eq(teamMemberships.userId, 'coach-1')).run()
    failAfterAuthorization = true
    assert.deepEqual(await operation.read(), { status: 'error' })
  } finally {
    sqlite.close()
  }
})
