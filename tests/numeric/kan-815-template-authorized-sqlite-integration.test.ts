import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type { db as ApplicationDatabase } from '@/db'
import { workouts } from '@/db/schema'
import { createH4aAuthorizationAdapter } from '@/lib/authorization/h4a-authorization-adapter'
import { createH4aActiveTeamAuthorizationBoundary } from '@/lib/authorization/h4a-active-team-authorization'
import { createWorkoutTemplateActionService } from '@/lib/workout-templates/workout-template-action-service'
import type { WorkoutTemplatePersistenceValues } from '@/lib/workout-templates/workout-template-persistence'
import { submitValidatedTemplateNumericDraft } from '@/lib/numeric/template-numeric-submit-boundary'

const at = '2026-10-17T20:00:00.000Z'
const values = (teamId: string, input: FormData): WorkoutTemplatePersistenceValues => ({
  teamId, category: 'quality', tags: [], title: 'KAN-815 regional template',
  type: 'Fartlek', distance: Number(input.get('distanceKm')),
  time: Number(input.get('durationMin')), gain: input.get('elevationGain') === '' ? null : Number(input.get('elevationGain')),
  intensityMethod: 'reference_percentage', zone: null,
  referencePercentage: Number(input.get('referencePercentage')),
  pace: null, notes: null, prescriptionNotes: null,
  trackPath: null, locationKey: null, structure: null,
})

function fixture() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`CREATE TABLE workouts (
    id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    team_id TEXT NOT NULL, category TEXT NOT NULL, tags TEXT NOT NULL,
    archived_at TEXT, title TEXT NOT NULL, type TEXT NOT NULL,
    distance REAL, time INTEGER, gain INTEGER, intensity_method TEXT,
    zone TEXT, reference_percentage REAL, pace INTEGER, notes TEXT,
    prescription_notes TEXT, track_path TEXT, location_key TEXT, structure TEXT)`)
  const database = drizzle(sqlite, { schema: { workouts } }) as unknown as typeof ApplicationDatabase
  const h4a = createH4aAuthorizationAdapter({
    async loadMemberships(userId, teamId) {
      return [{ userId, teamId, preset: 'coach' as const, isActive: true, effectiveFrom: '2026-10-01T00:00:00.000Z', effectiveUntil: null }]
    },
    async loadAthleteProfiles() { return [] },
    async loadGrants() { return [] },
  })
  const activeTeam = createH4aActiveTeamAuthorizationBoundary({
    async resolveActiveTeam() { return { status: 'resolved' as const, teamId: 'team-815', source: 'persisted' as const } },
    authorize: (access, request) => h4a.authorize(access, request),
  })
  const action = createWorkoutTemplateActionService({
    database,
    authenticate: async () => ({ status: 'authenticated' as const, userId: 'coach-815' }),
    resolveActiveTeam: async () => 'team-815',
    authorize: (access, teamId) => activeTeam.authorize(access, {
      capability: 'planning.manage', resource: { teamId }, requiredScope: 'team', at,
    }),
    now: () => at,
  })
  return { sqlite, action }
}

function input(distance: string, percentage = '75,5') {
  const data = new FormData()
  for (const [key, value] of Object.entries({ distanceKm: distance, durationMin: '60', elevationGain: '', referencePercentage: percentage })) data.set(key, value)
  return data
}

test('KAN-815/A2 comma and point reach same canonical SQLite value through authorized template service', async () => {
  const { sqlite, action } = fixture()
  try {
    for (const [raw, id] of [['12,5', 'comma'], ['12.5', 'point']] as const) {
      let write: Promise<unknown> | undefined
      assert.equal(submitValidatedTemplateNumericDraft(input(raw), 'reference_percentage', payload => {
        assert.equal(payload.get('distanceKm'), '12.5')
        write = action.create(id, values('team-815', payload))
      }), 'submitted')
      assert.deepEqual(await write, { status: 'allowed' })
    }
    const stored = sqlite.prepare('SELECT id, team_id, distance, time, gain, reference_percentage FROM workouts ORDER BY id').all()
    assert.deepEqual(stored, [
      { id: 'comma', team_id: 'team-815', distance: 12.5, time: 60, gain: null, reference_percentage: 75.5 },
      { id: 'point', team_id: 'team-815', distance: 12.5, time: 60, gain: null, reference_percentage: 75.5 },
    ])
  } finally { sqlite.close() }
})

test('KAN-815/A2 invalid draft does not call authorized writer or change SQLite', async () => {
  const { sqlite, action } = fixture()
  try {
    const before = sqlite.prepare('SELECT * FROM workouts ORDER BY id').all()
    let invoked = 0
    const result = submitValidatedTemplateNumericDraft(input('12,5', '75,'), 'reference_percentage', payload => {
      invoked++
      void action.create('should-not-exist', values('team-815', payload))
    })
    assert.equal(result, 'invalid')
    assert.equal(invoked, 0)
    assert.deepEqual(sqlite.prepare('SELECT * FROM workouts ORDER BY id').all(), before)
  } finally { sqlite.close() }
})
