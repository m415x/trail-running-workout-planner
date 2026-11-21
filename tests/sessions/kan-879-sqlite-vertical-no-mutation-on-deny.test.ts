import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import Database from 'better-sqlite3'

import { executeAuthorizedSessionMutation } from '../../lib/sessions/authorized-session-mutation'
import type { VerticalBlockV1 } from '../../lib/sessions/vertical-prescription'

const block: VerticalBlockV1 = {
  schemaVersion: 1,
  direction: 'ascent',
  repetitions: 2,
  coverage: 'complete',
  elevationGainPerRep: { meters: 400, provenance: { kind: 'coach_manual' } },
  elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } },
}

type VerticalEdit = {
  microcycleId: string
  elevationGain: number | null
  primaryObjective?: 'distance' | 'elevation_gain' | 'duration' | null
  verticalBlock?: VerticalBlockV1 | null
}

test('KAN-879 RED-7 rejects a later contradictory microcycle with zero durable SQLite writes', async () => {
  const modulePath = new URL('../../lib/sessions/session-vertical-edit-preflight.ts', import.meta.url)
  const imported = await import(modulePath.href).catch(() => ({}))
  const preflight = Reflect.get(imported, 'preflightVerticalSessionEdits') as
    | ((input: {
      previous: Array<{ microcycleId: string; elevationGain: number | null; primaryObjective: 'elevation_gain' | null; verticalBlockJson: string | null }>
      edits: VerticalEdit[]
    }) => unknown)
    | undefined
  assert.equal(typeof preflight, 'function', 'RED-7: shared transactional vertical preflight is missing')
  if (!preflight) return

  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE sessions (id TEXT PRIMARY KEY, title TEXT NOT NULL);
      CREATE TABLE group_session_prescriptions (
        session_id TEXT NOT NULL, microcycle_id TEXT NOT NULL,
        elevation_gain INTEGER, primary_objective TEXT, vertical_block_json TEXT,
        PRIMARY KEY (session_id, microcycle_id)
      );
      CREATE TABLE session_generation_modification_records (
        id TEXT PRIMARY KEY, previous_value TEXT, new_value TEXT
      );
      INSERT INTO sessions VALUES ('session-a','Original');
      INSERT INTO group_session_prescriptions VALUES ('session-a','week-a',800,'elevation_gain',NULL);
      INSERT INTO group_session_prescriptions VALUES ('session-a','week-b',800,'elevation_gain',NULL);
      INSERT INTO session_generation_modification_records VALUES ('audit-before','original','original');
    `)
    const readState = () => ({
      sessions: sqlite.prepare('SELECT * FROM sessions ORDER BY id').all(),
      prescriptions: sqlite.prepare('SELECT * FROM group_session_prescriptions ORDER BY microcycle_id').all(),
      audit: sqlite.prepare('SELECT * FROM session_generation_modification_records ORDER BY id').all(),
    })
    const before = readState()
    let authorizationCalls = 0
    let mutations = 0
    const edits: VerticalEdit[] = [
      { microcycleId: 'week-a', elevationGain: 800 },
      { microcycleId: 'week-b', elevationGain: 900, verticalBlock: block },
    ]

    await assert.rejects(
      () => executeAuthorizedSessionMutation({
        existingGroupIds: ['group-a'],
        resultingGroupIds: ['group-a'],
        authorizeGroup: async () => { authorizationCalls++; return true },
        mutate: () => sqlite.transaction(() => {
          // The same preflight must be reused by the actual updateSession.
          preflight({
            previous: [
              { microcycleId: 'week-a', elevationGain: 800, primaryObjective: 'elevation_gain', verticalBlockJson: null },
              { microcycleId: 'week-b', elevationGain: 800, primaryObjective: 'elevation_gain', verticalBlockJson: null },
            ],
            edits,
          })
          mutations++
          sqlite.prepare("UPDATE sessions SET title = 'Changed' WHERE id = 'session-a'").run()
          sqlite.prepare('UPDATE group_session_prescriptions SET elevation_gain = 900 WHERE session_id = ? AND microcycle_id = ?')
            .run('session-a', 'week-b')
          sqlite.prepare("INSERT INTO session_generation_modification_records VALUES ('audit-after','before','after')").run()
        }).immediate(),
      }),
      /complete|elevation|vertical/i,
    )
    assert.equal(authorizationCalls, 1)
    assert.equal(mutations, 0, 'All scopes are checked before the first write')
    assert.deepEqual(readState(), before, 'Sessions, prescriptions and audit must remain byte-equivalent after DENY')
  } finally {
    sqlite.close()
  }
})

test('KAN-879 RED-7 updateSession calls the same proven vertical preflight before its first mutation', () => {
  const source = readFileSync('app/actions/session-actions.ts', 'utf8')
  assert.match(source, /import \{ preflightVerticalSessionEdits \} from ['"]@\/lib\/sessions\/session-vertical-edit-preflight['"]/)
  const update = source.slice(source.indexOf('export async function updateSession('))
  const entry = update.indexOf('mutate: () => db.transaction((tx) => {')
  const preflight = update.indexOf('preflightVerticalSessionEdits(')
  const firstWrite = update.indexOf('tx.update(sessions)')
  assert.ok(entry >= 0 && preflight > entry && preflight < firstWrite,
    'Shared real-SQLite preflight must precede every durable Session/Audit write')
})
