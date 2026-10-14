import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import { workouts } from '@/db/schema'
import type { db as ApplicationDatabase } from '@/db'
import { createH4aActiveTeamAuthorizationBoundary } from '@/lib/authorization/h4a-active-team-authorization'
import { createH4aAuthorizationAdapter } from '@/lib/authorization/h4a-authorization-adapter'
import { createWorkoutTemplateRecord, type WorkoutTemplatePersistenceValues } from '@/lib/workout-templates/workout-template-persistence'
import { createAuthorizedWorkoutTemplateOperations } from '@/lib/workout-templates/authorized-workout-template-operations'

const NOW = '2026-10-13T15:00:00.000Z'
const values = (teamId: string): WorkoutTemplatePersistenceValues => ({
  teamId, category: 'quality', tags: [], title: `Template ${teamId}`,
  type: 'Fartlek', distance: 10, time: 60, gain: 100,
  intensityMethod: 'hr_zone', zone: 'Z2', referencePercentage: null,
  pace: null, notes: null, prescriptionNotes: null,
  trackPath: null, locationKey: null, structure: null,
})

let sqlite: Database.Database
let database: typeof ApplicationDatabase
let activeTeam = 'team-b'
let preset: 'coach' | 'assistant' = 'coach'
let membershipActive = true
let authenticated = true

beforeEach(() => {
  sqlite = new Database(':memory:')
  sqlite.exec(`CREATE TABLE workouts (
    id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    team_id TEXT NOT NULL, category TEXT NOT NULL, tags TEXT NOT NULL,
    archived_at TEXT, title TEXT NOT NULL, type TEXT NOT NULL,
    distance REAL, time INTEGER, gain INTEGER, intensity_method TEXT,
    zone TEXT, reference_percentage REAL, pace INTEGER, notes TEXT,
    prescription_notes TEXT, track_path TEXT, location_key TEXT, structure TEXT)`)
  database = drizzle(sqlite, { schema: { workouts } }) as unknown as typeof ApplicationDatabase
  createWorkoutTemplateRecord({ id: 'template-a', values: values('team-a'), database, now: NOW })
  createWorkoutTemplateRecord({ id: 'template-b', values: values('team-b'), database, now: NOW })
  activeTeam = 'team-b'
  preset = 'coach'
  membershipActive = true
  authenticated = true
})
afterEach(() => sqlite.close())

function services() {
  const h4a = createH4aAuthorizationAdapter({
    async loadMemberships(userId, teamId) {
      return [{ userId, teamId, preset, isActive: membershipActive,
        effectiveFrom: '2026-10-01T00:00:00.000Z', effectiveUntil: null }]
    },
    async loadAthleteProfiles() { return [] },
    async loadGrants() { return [] },
  })
  const active = createH4aActiveTeamAuthorizationBoundary({
    async resolveActiveTeam() { return { status: 'resolved', teamId: activeTeam, source: 'persisted' } },
    authorize: (access, request) => h4a.authorize(access, request),
  })
  return createAuthorizedWorkoutTemplateOperations({
    database,
    resolveActiveTeam: async () => activeTeam,
    authenticate: async () => authenticated
      ? { status: 'authenticated' as const, userId: 'coach-794' }
      : { status: 'forbidden' as const, reason: 'unlinked' as const },
    authorize: async (access, teamId) => active.authorize(access, {
      capability: 'planning.manage', resource: { teamId }, at: NOW, requiredScope: 'team',
    }),
  })
}

function persistedState() {
  return sqlite.prepare('SELECT id, team_id, title, archived_at, updated_at FROM workouts ORDER BY id').all()
}

test('KAN-794 active Team B sees only Team B catalogue and cannot mutate Team A templates', async () => {
  const operations = services()
  const found = await operations.list()
  assert.equal(found.status, 'allowed')
  if (found.status !== 'allowed') return
  assert.deepEqual(found.templates.map(item => item.id), ['template-b'])
  const before = persistedState()
  assert.deepEqual(await operations.archive('template-a', true), { status: 'denied' })
  assert.deepEqual(await operations.duplicate('template-a', 'copy-cross-team'), { status: 'denied' })
  assert.deepEqual(persistedState(), before, 'Cross-Team DENY must make no durable changes')
})

test('KAN-794 Team switch and missing H2/H3 capability or revoked membership fail closed without writes', async () => {
  const operations = services()
  const first = await operations.list()
  assert.equal(first.status, 'allowed')
  activeTeam = 'team-a'
  const switched = await operations.list()
  assert.equal(switched.status, 'allowed')
  if (switched.status === 'allowed') assert.deepEqual(switched.templates.map(item => item.id), ['template-a'])

  const before = persistedState()
  preset = 'assistant'
  assert.deepEqual(await operations.archive('template-a', true), { status: 'denied' })
  preset = 'coach'
  membershipActive = false
  assert.deepEqual(await operations.archive('template-a', true), { status: 'denied' })
  membershipActive = true
  authenticated = false
  assert.deepEqual(await operations.archive('template-a', true), { status: 'denied' })
  assert.deepEqual(persistedState(), before, 'Capability, membership and H2 DENY must never mutate SQLite')
})
