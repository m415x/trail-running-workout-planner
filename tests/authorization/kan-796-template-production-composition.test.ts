import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, test } from 'node:test'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import type { db as ApplicationDatabase } from '@/db'
import { workouts } from '@/db/schema'
import { resolveActiveTeamContext } from '@/lib/authorization/active-team-context'
import { createH4aAuthorizationAdapter } from '@/lib/authorization/h4a-authorization-adapter'
import { createWorkoutTemplateRecord, type WorkoutTemplatePersistenceValues } from '@/lib/workout-templates/workout-template-persistence'
import { createWorkoutTemplateActionComposition } from '@/lib/workout-templates/workout-template-action-composition'

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
let actor: string | null
let selectedTeam: string
let revoked: boolean
let preset: 'coach' | 'assistant'
const resolutionLog: string[] = []

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
  createWorkoutTemplateRecord({ id: 'template-a', values: values('team-a'), now: at, database })
  createWorkoutTemplateRecord({ id: 'template-b', values: values('team-b'), now: at, database })
  actor = 'coach-a'
  selectedTeam = 'team-a'
  revoked = false
  preset = 'coach'
  resolutionLog.length = 0
})
afterEach(() => sqlite.close())

function composition() {
  // Only external session and Team inputs are controlled. H2, H3 membership
  // resolution, H4A effective capability and repositories run real code.
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
  return createWorkoutTemplateActionComposition({
    database,
    readAccess: async () => actor
      ? { status: 'authenticated' as const, userId: actor }
      : { status: 'anonymous' as const },
    resolveActiveTeam: async userId => {
      resolutionLog.push(`${userId}:${selectedTeam}`)
      return resolveActiveTeamContext({
        persistedTeamId: selectedTeam,
        memberships: [{
          teamId: selectedTeam, isActive: !revoked, isDeleted: false,
          effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveUntil: null,
        }],
        onDate: at,
      })
    },
    authorize: (access, request) => h4a.authorize(access, request),
    now: () => at,
  })
}
function snapshot() {
  return sqlite.prepare('SELECT * FROM workouts ORDER BY id').all()
}

test('KAN-796 productive composition resolves H2/Team/H4A fresh across Team A to B and actor switch', async () => {
  const adapter = composition()
  const first = await adapter.service().list()
  assert.equal(first.status, 'allowed')
  if (first.status === 'allowed') assert.deepEqual(first.templates.map(row => row.id), ['template-a'])
  selectedTeam = 'team-b'
  const switched = await adapter.service().list()
  assert.equal(switched.status, 'allowed')
  if (switched.status === 'allowed') assert.deepEqual(switched.templates.map(row => row.id), ['template-b'])
  actor = 'coach-b'
  const before = snapshot()
  assert.deepEqual(await adapter.service().update('template-a', values('team-b')), { status: 'denied' })
  assert.deepEqual(snapshot(), before)
  assert.deepEqual(resolutionLog, ['coach-a:team-a', 'coach-a:team-b', 'coach-b:team-b'],
    'Each operation must re-resolve Team for the current H2 actor, never reuse a previous session')
})

test('KAN-796 productive composition rejects invalid H2, revoked membership and absent planning.manage without writes', async () => {
  const adapter = composition()
  const before = snapshot()
  actor = null
  assert.deepEqual(await adapter.service().archive('template-a', true), { status: 'denied' })
  actor = 'coach-a'
  revoked = true
  assert.deepEqual(await adapter.service().archive('template-a', true), { status: 'denied' })
  revoked = false
  preset = 'assistant'
  assert.deepEqual(await adapter.service().create('unauthorized', values('team-a')), { status: 'denied' })
  assert.deepEqual(snapshot(), before)
  assert.deepEqual(resolutionLog, ['coach-a:team-a', 'coach-a:team-a'],
    'Invalid H2 must fail before Team lookup; subsequent requests must resolve anew')
})

test('KAN-796 seven production entry points share the behavior-tested composition', () => {
  const source = readFileSync('app/actions/workout-template-actions.ts', 'utf8')
  assert.match(source, /createWorkoutTemplateActionComposition/)
  const operations = [
    'getWorkoutTemplates', 'getWorkoutTemplateById', 'getWorkoutTemplateFormOptions',
    'createWorkoutTemplate', 'updateWorkoutTemplate', 'duplicateWorkoutTemplate',
    'setWorkoutTemplateArchiveStatus',
  ]
  for (const name of operations) {
    const start = source.indexOf(`export async function ${name}(`)
    assert.ok(start >= 0, `Missing Server Action ${name}`)
    const next = source.indexOf('\nexport async function ', start + 1)
    const body = source.slice(start, next === -1 ? undefined : next)
    assert.match(body, /workoutTemplateActionComposition\(/,
      `${name}: must acquire the shared production adapter per operation`)
  }
  const navigation = readFileSync('lib/authorization/coach-navigation-policy.ts', 'utf8')
  assert.match(navigation, /href: '\/dashboard\/templates', visibility: \{ kind: 'hidden' \}/)
})
