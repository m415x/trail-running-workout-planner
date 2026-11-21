import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import Database from 'better-sqlite3'

import { executeAuthorizedSessionMutation } from '../../lib/sessions/authorized-session-mutation'

test('KAN-879 RED-10 denied target group prevents creation of Session, prescription and audit in real SQLite', async () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE sessions (id TEXT PRIMARY KEY, team_id TEXT NOT NULL);
      CREATE TABLE prescriptions (session_id TEXT, group_id TEXT, vertical_block_json TEXT);
      CREATE TABLE audit (id TEXT PRIMARY KEY, session_id TEXT);
      INSERT INTO sessions VALUES ('existing','team-a');
      INSERT INTO prescriptions VALUES ('existing','group-a',NULL);
      INSERT INTO audit VALUES ('existing-audit','existing');
    `)
    const snapshot = () => ({
      sessions: sqlite.prepare('SELECT * FROM sessions ORDER BY id').all(),
      prescriptions: sqlite.prepare('SELECT * FROM prescriptions ORDER BY session_id').all(),
      audit: sqlite.prepare('SELECT * FROM audit ORDER BY id').all(),
    })
    const before = snapshot()
    const calls: string[] = []
    let mutationInvoked = false
    const allowed = await executeAuthorizedSessionMutation({
      existingGroupIds: [],
      resultingGroupIds: ['group-a', 'group-foreign'],
      authorizeGroup: async groupId => {
        calls.push(groupId)
        return groupId === 'group-a'
      },
      mutate: () => sqlite.transaction(() => {
        mutationInvoked = true
        sqlite.prepare("INSERT INTO sessions VALUES ('new','team-a')").run()
        sqlite.prepare("INSERT INTO prescriptions VALUES ('new','group-foreign','{}')").run()
        sqlite.prepare("INSERT INTO audit VALUES ('new-audit','new')").run()
      }).immediate(),
    })

    assert.equal(allowed, false)
    assert.deepEqual(calls.sort(), ['group-a', 'group-foreign'])
    assert.equal(mutationInvoked, false)
    assert.deepEqual(snapshot(), before, 'Unauthorized Group must leave Session, prescriptions and audit identical')
  } finally {
    sqlite.close()
  }
})

test('KAN-879 RED-10 createSession uses shared authorized mutation boundary with H4A server-owned groups', () => {
  const source = readFileSync('app/actions/session-actions.ts', 'utf8')
  const start = source.indexOf('export async function createSession(')
  const end = source.indexOf('export async function updateSession(', start)
  const create = source.slice(start, end)
  assert.ok(start >= 0 && end > start)
  assert.match(create, /planningReadAccess\(\)/,
    'Session identity and Active Team must derive from server context')
  assert.match(create, /validatePrescriptionReferences\(prescriptions\.data, data\.date, planningAccess\.teamId\)/,
    'Team/Plan/Microcycle references must be validated')
  const authorized = create.indexOf('executeAuthorizedSessionMutation(')
  const firstWrite = create.indexOf('tx.insert(sessions)')
  assert.ok(authorized >= 0 && authorized < firstWrite,
    'Create must use the proven shared authorized mutation boundary before any insert')
  const authorization = create.slice(authorized, authorized + 650)
  assert.match(authorization, /existingGroupIds:\s*\[\s*\]/,
    'Creation cannot inherit groups from another Session')
  assert.match(authorization, /resultingGroupIds:\s*requestedGroups/,
    'Every resulting group is authorized, not only the first group')
  assert.match(authorization, /authorizeGroup:\s*planningAccess\.authorizeGroup/,
    'H4A capability planning.manage must remain server-owned')
  assert.match(authorization, /mutate:\s*\(\)\s*=>\s*db\.transaction/,
    'Authorization must guard the actual transaction callback')
  assert.match(create, /preflightVerticalSessionEdits\(\{\s*previous:\s*\[\s*\],\s*edits:\s*prescriptions\.data/,
    'Preserve prior GREEN-8 final vertical dose validation')
})
