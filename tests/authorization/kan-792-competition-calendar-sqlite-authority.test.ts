import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import type { db as ApplicationDatabase } from '@/db'
import { athleteGroups, groupTrainingPlans } from '@/db/schema'
import { competitionEntries } from '@/db/competition-entry-schema'
import { resolveActiveTeamContext } from '@/lib/authorization/active-team-context'
import { createH4aAuthorizationAdapter } from '@/lib/authorization/h4a-authorization-adapter'
import { createAuthorizedCompetitionCalendarReader } from '@/lib/periodization/authorized-competition-calendar-reader'

const now = '2026-10-13T15:00:00.000Z'
let sqlite: Database.Database
let database: typeof ApplicationDatabase
let actor: string | null
let activeTeam: string
let revoked: boolean
let preset: 'coach' | 'assistant'
const resolvedFor: string[] = []

beforeEach(() => {
  sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE athlete_groups (
      id TEXT PRIMARY KEY, team_id TEXT NOT NULL, category_code TEXT NOT NULL,
      level_code TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE group_training_plans (
      id TEXT PRIMARY KEY, group_id TEXT NOT NULL, planning_cohort_id TEXT,
      source_group_training_plan_id TEXT, title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft', notes TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE competition_entries (
      id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL,
      name TEXT NOT NULL, date TEXT NOT NULL, distance_km REAL NOT NULL,
      elevation_gain_m REAL, priority TEXT NOT NULL, status TEXT NOT NULL,
      description TEXT, is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `)
  const insertGroup = sqlite.prepare("INSERT INTO athlete_groups (id, team_id, category_code, level_code, created_at, updated_at) VALUES (?, ?, 'M', '1', ?, ?)")
  const insertPlan = sqlite.prepare("INSERT INTO group_training_plans (id, group_id, planning_cohort_id, source_group_training_plan_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
  const insertEntry = sqlite.prepare("INSERT INTO competition_entries (id, group_training_plan_id, name, date, distance_km, priority, status, created_at, updated_at) VALUES (?, ?, ?, '2026-11-10', 21, 'B', 'planned', ?, ?)")
  for (const team of ['a', 'b']) {
    insertGroup.run(`group-${team}`, `team-${team}`, now, now)
    insertPlan.run(`base-${team}`, `group-${team}`, null, null, `Base ${team}`, now, now)
    insertPlan.run(`variant-${team}`, `group-${team}`, `cohort-${team}`, `base-${team}`, `Variant ${team}`, now, now)
    insertEntry.run(`entry-base-${team}`, `base-${team}`, `Race Base ${team}`, now, now)
    insertEntry.run(`entry-variant-${team}`, `variant-${team}`, `Race Variant ${team}`, now, now)
  }
  insertPlan.run('empty-a', 'group-a', null, null, 'Empty A', now, now)
  database = drizzle(sqlite, { schema: { athleteGroups, groupTrainingPlans, competitionEntries } }) as unknown as typeof ApplicationDatabase
  actor = 'coach-a'
  activeTeam = 'team-a'
  revoked = false
  preset = 'coach'
  resolvedFor.length = 0
})
afterEach(() => sqlite.close())

function reader() {
  const h4a = createH4aAuthorizationAdapter({
    async loadMemberships(userId, teamId) {
      return [{
        userId, teamId, preset, isActive: !revoked,
        effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveUntil: null,
      }]
    },
    async loadAthleteProfiles() { return [] },
    async loadGrants() { return [] },
  })
  return createAuthorizedCompetitionCalendarReader({
    database,
    readAccess: async () => actor
      ? { status: 'authenticated' as const, provider: 'supabase', subject: `subject-${actor}`, userId: actor }
      : { status: 'anonymous' as const },
    resolveActiveTeam: async (userId: string) => {
      resolvedFor.push(`${userId}:${activeTeam}`)
      return resolveActiveTeamContext({
        persistedTeamId: activeTeam,
        memberships: [{
          teamId: activeTeam, isActive: !revoked, isDeleted: false,
          effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveUntil: null,
        }],
        onDate: now,
      })
    },
    authorize: (access, request) => h4a.authorize(access, { ...request, teamId: request.resource.teamId }),
    now: () => now,
  })
}

const state = () => sqlite.prepare('SELECT * FROM competition_entries ORDER BY id').all()

test('KAN-792 reader preserves Plan Base/Variant and authorized empty separate from DENY', async () => {
  const action = reader()
  const base = await action.read('base-a')
  assert.equal(base.status, 'allowed')
  if (base.status === 'allowed') assert.deepEqual(base.competitions.map(c => c.id), ['entry-base-a'])
  const variant = await action.read('variant-a')
  assert.equal(variant.status, 'allowed')
  if (variant.status === 'allowed') assert.deepEqual(variant.competitions.map(c => c.id), ['entry-variant-a'])
  assert.deepEqual(await action.read('empty-a'), { status: 'allowed', competitions: [] })
  const before = state()
  assert.deepEqual(await action.read('base-b'), { status: 'denied' })
  assert.deepEqual(state(), before)
})

test('KAN-792 Team A to B, actor switch, revocation and absent planning.manage are checked fresh', async () => {
  const action = reader()
  activeTeam = 'team-b'
  const b = await action.read('base-b')
  assert.equal(b.status, 'allowed')
  actor = 'coach-b'
  assert.deepEqual(await action.read('base-a'), { status: 'denied' })
  const before = state()
  revoked = true
  assert.deepEqual(await action.read('base-b'), { status: 'denied' })
  revoked = false
  preset = 'assistant'
  assert.deepEqual(await action.read('base-b'), { status: 'denied' })
  actor = null
  assert.deepEqual(await action.read('base-b'), { status: 'denied' })
  assert.deepEqual(state(), before)
  assert.deepEqual(resolvedFor, [
    'coach-a:team-b', 'coach-b:team-b', 'coach-b:team-b', 'coach-b:team-b',
  ], 'Invalid H2 must stop before H3; every authenticated invocation re-resolves Team')
})
