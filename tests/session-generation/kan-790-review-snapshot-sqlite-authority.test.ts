import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import Database from 'better-sqlite3'

import { createH4aAuthorizationAdapter } from '@/lib/authorization/h4a-authorization-adapter'
import { createAuthorizedReviewSnapshotSqliteScope } from '@/lib/session-generation/authorized-review-snapshot-sqlite-scope'

const at = '2026-10-14T15:00:00.000Z'

function setup() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE teams (id TEXT PRIMARY KEY);
    CREATE TABLE athlete_groups (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_deleted INTEGER DEFAULT 0);
    CREATE TABLE planning_cohorts (id TEXT PRIMARY KEY, group_id TEXT NOT NULL);
    CREATE TABLE group_training_plans (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, planning_cohort_id TEXT, is_deleted INTEGER DEFAULT 0);
  `)
  for (const table of ['users', 'teams']) for (const id of table === 'users' ? ['coach', 'other'] : ['a', 'b']) {
    sqlite.prepare(`INSERT INTO ${table} (id) VALUES (?)`).run(id)
  }
  sqlite.exec(`
    INSERT INTO athlete_groups VALUES ('group-a','a',0), ('group-b','b',0);
    INSERT INTO planning_cohorts VALUES ('cohort-a','group-a');
    INSERT INTO group_training_plans VALUES ('base-a','group-a',NULL,0),
      ('variant-a','group-a','cohort-a',0), ('base-b','group-b',NULL,0);
  `)
  sqlite.exec(readFileSync('drizzle/sqlite/0026_session_generation_review_snapshots.sql', 'utf8'))
  sqlite.prepare(`INSERT INTO session_generation_review_snapshots
    (id,user_id,team_id,group_training_plan_id,group_id,planning_cohort_id,
     schema_version,generator_version,proposal,generation_explanations,source_manifest,
     created_at,expires_at,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'active')`).run(
    'review-a','coach','a','variant-a','group-a','cohort-a',
    '1','1','{}','{}','{}',at,'2026-10-14T15:30:00.000Z',
  )
  let actor: string | null = 'coach'
  let activeTeam: string | null = 'a'
  let memberActive = true
  let preset: 'coach' | 'assistant' = 'coach'
  const h4a = createH4aAuthorizationAdapter({
    async loadMemberships(userId, teamId) {
      return [{ userId, teamId, preset, isActive: memberActive,
        effectiveFrom: '2026-10-01T00:00:00.000Z', effectiveUntil: null }]
    },
    async loadAthleteProfiles() { return [] },
    async loadGrants() { return [] },
  })
  const service = createAuthorizedReviewSnapshotSqliteScope({
    sqlite,
    authenticate: async () => actor,
    resolveActiveTeam: async () => activeTeam,
    authorizePlanning: async (userId, teamId, groupId) => {
      const decision = await h4a.authorize({ status: 'authenticated', userId }, {
        capability: 'planning.manage',
        resource: { teamId, sportingGroupId: groupId }, at,
      })
      return decision.allowed
    },
    now: () => at,
  })
  const state = () => sqlite.prepare('SELECT * FROM session_generation_review_snapshots ORDER BY id').all()
  return {
    sqlite, service, state,
    setActor: (value: string | null) => { actor = value },
    setTeam: (value: string | null) => { activeTeam = value },
    revoke: () => { memberActive = false },
    setAssistant: () => { preset = 'assistant' },
  }
}

test('KAN-790 T5.1 real SQLite scope authorizes Base and Variant and preserves read-only state', async () => {
  const f = setup()
  try {
    const before = f.state()
    assert.equal((await f.service.resolve({ groupTrainingPlanId: 'base-a' })).kind, 'authorized')
    assert.equal((await f.service.resolve({ groupTrainingPlanId: 'variant-a', snapshotId: 'review-a' })).kind, 'authorized')
    assert.deepEqual(f.state(), before)
  } finally { f.sqlite.close() }
})

test('KAN-790 T5.1 H2 H3 H4A Team switch and snapshot identity DENY never write to SQLite', async () => {
  const f = setup()
  try {
    const before = f.state()
    for (const planId of ['base-b', 'missing']) {
      assert.deepEqual(await f.service.resolve({ groupTrainingPlanId: planId }), { kind: 'denied' })
    }
    assert.deepEqual(await f.service.resolve({ groupTrainingPlanId: 'base-a', snapshotId: 'review-a' }), { kind: 'denied' })
    f.setTeam('b')
    assert.deepEqual(await f.service.resolve({ groupTrainingPlanId: 'variant-a', snapshotId: 'review-a' }), { kind: 'denied' })
    f.setTeam('a')
    f.revoke()
    assert.deepEqual(await f.service.resolve({ groupTrainingPlanId: 'variant-a', snapshotId: 'review-a' }), { kind: 'denied' })
    f.setActor(null)
    assert.deepEqual(await f.service.resolve({ groupTrainingPlanId: 'variant-a', snapshotId: 'review-a' }), { kind: 'denied' })
    assert.deepEqual(f.state(), before)
  } finally { f.sqlite.close() }
})

test('KAN-790 T5.1 unauthorized assistant cannot access active Coach review snapshot', async () => {
  const f = setup()
  try {
    const before = f.state()
    f.setAssistant()
    assert.deepEqual(await f.service.resolve({ groupTrainingPlanId: 'variant-a', snapshotId: 'review-a' }), { kind: 'denied' })
    assert.deepEqual(f.state(), before)
  } finally { f.sqlite.close() }
})
