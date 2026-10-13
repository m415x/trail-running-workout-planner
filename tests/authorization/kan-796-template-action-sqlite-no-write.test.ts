import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { beforeEach, afterEach, test } from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type { db as ApplicationDatabase } from '@/db'
import { workouts } from '@/db/schema'
import { createH4aAuthorizationAdapter } from '@/lib/authorization/h4a-authorization-adapter'
import { createH4aActiveTeamAuthorizationBoundary } from '@/lib/authorization/h4a-active-team-authorization'
import { createWorkoutTemplateRecord, type WorkoutTemplatePersistenceValues } from '@/lib/workout-templates/workout-template-persistence'
import { createWorkoutTemplateActionService } from '@/lib/workout-templates/workout-template-action-service'

const at = '2026-10-13T15:00:00.000Z'
const values = (teamId: string): WorkoutTemplatePersistenceValues => ({
  teamId, category: 'quality', tags: [], title: `Template ${teamId}`,
  type: 'Fartlek', distance: 10, time: 60, gain: 100,
  intensityMethod: 'hr_zone', zone: 'Z2', referencePercentage: null,
  pace: null, notes: null, prescriptionNotes: null,
  trackPath: null, locationKey: null, structure: null,
})

let sqlite: Database.Database
let database: typeof ApplicationDatabase
let activeTeam: string
let membershipActive: boolean
let preset: 'coach' | 'assistant'

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
  createWorkoutTemplateRecord({ id: 'a', values: values('team-a'), now: at, database })
  createWorkoutTemplateRecord({ id: 'b', values: values('team-b'), now: at, database })
  activeTeam = 'team-b'
  membershipActive = true
  preset = 'coach'
})
afterEach(() => sqlite.close())

function service() {
  const h4a = createH4aAuthorizationAdapter({
    async loadMemberships(userId, teamId) {
      return [{
        userId, teamId, preset, isActive: membershipActive,
        effectiveFrom: '2026-10-01T00:00:00.000Z', effectiveUntil: null,
      }]
    },
    async loadAthleteProfiles() { return [] },
    async loadGrants() { return [] },
  })
  const teamBoundary = createH4aActiveTeamAuthorizationBoundary({
    async resolveActiveTeam() {
      return { status: 'resolved', teamId: activeTeam, source: 'persisted' }
    },
    authorize: (access, request) => h4a.authorize(access, request),
  })
  return createWorkoutTemplateActionService({
    database,
    authenticate: async () => ({ status: 'authenticated' as const, userId: 'coach-796' }),
    resolveActiveTeam: async () => activeTeam,
    authorize: (access, teamId) => teamBoundary.authorize(access, {
      capability: 'planning.manage', resource: { teamId }, requiredScope: 'team', at,
    }),
    now: () => at,
  })
}

function snapshot() {
  return sqlite.prepare('SELECT id, team_id, title, archived_at, updated_at FROM workouts ORDER BY id').all()
}

test('KAN-796 action service denies Team B writes on Team A and preserves SQLite exactly', async () => {
  const action = service()
  const before = snapshot()
  assert.deepEqual(await action.update('a', values('team-b')), { status: 'denied' })
  assert.deepEqual(await action.duplicate('a', 'injected-copy'), { status: 'denied' })
  assert.deepEqual(await action.archive('a', true), { status: 'denied' })
  assert.deepEqual(snapshot(), before)
})

test('KAN-796 revoked membership or missing planning.manage cannot create, update or reactivate', async () => {
  const action = service()
  const before = snapshot()
  membershipActive = false
  assert.deepEqual(await action.create('new-template', values('team-b')), { status: 'denied' })
  assert.deepEqual(await action.update('b', values('team-b')), { status: 'denied' })
  assert.deepEqual(await action.archive('b', false), { status: 'denied' })
  membershipActive = true
  preset = 'assistant'
  assert.deepEqual(await action.create('other-template', values('team-b')), { status: 'denied' })
  assert.deepEqual(snapshot(), before)
})

test('KAN-796 permitted Team switch scopes list and write ownership to actual active Team', async () => {
  const action = service()
  const teamB = await action.list()
  assert.equal(teamB.status, 'allowed')
  if (teamB.status === 'allowed') assert.deepEqual(teamB.templates.map(t => t.id), ['b'])
  activeTeam = 'team-a'
  const teamA = await action.list()
  assert.equal(teamA.status, 'allowed')
  if (teamA.status === 'allowed') assert.deepEqual(teamA.templates.map(t => t.id), ['a'])
  assert.deepEqual(await action.create('new-a', values('team-b')), { status: 'allowed' })
  const inserted = sqlite.prepare('SELECT team_id FROM workouts WHERE id = ?').get('new-a') as { team_id: string }
  assert.equal(inserted.team_id, 'team-a', 'Client-supplied teamId must not replace active Team ownership')
})

test('KAN-796 action service is used by the real Server Action module', () => {
  const product = readFileSync('app/actions/workout-template-actions.ts', 'utf8')
  assert.match(product, /createWorkoutTemplateActionService/,
    'SQLite-tested action service must be invoked by production, not left as unused test-only code')
})
