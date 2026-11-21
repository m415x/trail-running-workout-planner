import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'
import Database from 'better-sqlite3'

test('KAN-879 RED-11 real SQLite authorized read refuses foreign Team and partial H4A Group grants', async () => {
  const path = fileURLToPath(new URL('../../lib/sessions/authorized-session-read-scope.ts', import.meta.url))
  const imported = await import(pathToFileURL(path).href).catch(() => ({}))
  const authorize = Reflect.get(imported, 'authorizeSessionReadScope') as
    | ((input: {
      sessionId: string
      teamId: string
      findSessionTeam(id: string): string | null
      findPrescriptionGroups(id: string): string[]
      authorizeGroup(id: string): Promise<boolean>
    }) => Promise<boolean>)
    | undefined
  assert.equal(typeof authorize, 'function', 'RED-11: reusable Session read authorization boundary missing')
  if (!authorize) return

  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE sessions (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_deleted INTEGER NOT NULL);
      CREATE TABLE prescriptions (session_id TEXT NOT NULL, group_id TEXT NOT NULL, is_deleted INTEGER NOT NULL);
      INSERT INTO sessions VALUES ('session-a','team-a',0), ('session-b','team-b',0), ('deleted','team-a',1);
      INSERT INTO prescriptions VALUES ('session-a','group-a',0), ('session-a','group-private',0),
        ('session-a','ignored-deleted',1), ('session-b','group-b',0);
    `)
    const groupsQueried: string[] = []
    const base = {
      teamId: 'team-a',
      findSessionTeam: (id: string) => {
        const row = sqlite.prepare('SELECT team_id FROM sessions WHERE id = ? AND is_deleted = 0')
          .get(id) as { team_id: string } | undefined
        return row?.team_id ?? null
      },
      findPrescriptionGroups: (id: string) => (sqlite.prepare(
        'SELECT group_id FROM prescriptions WHERE session_id = ? AND is_deleted = 0',
      ).all(id) as Array<{ group_id: string }>).map(row => row.group_id),
      authorizeGroup: async (groupId: string) => {
        groupsQueried.push(groupId)
        return groupId === 'group-a'
      },
    }

    assert.equal(await authorize({ ...base, sessionId: 'session-b' }), false,
      'Foreign Team session must be denied before Group authorization')
    assert.deepEqual(groupsQueried, [], 'Foreign Team identity must not traverse Group visibility')

    assert.equal(await authorize({ ...base, sessionId: 'deleted' }), false,
      'Soft-deleted session cannot be read')
    assert.equal(await authorize({ ...base, sessionId: 'session-a' }), false,
      'One denied H4A Group must deny the entire multi-Group Session read')
    assert.deepEqual(groupsQueried.sort(), ['group-a', 'group-private'],
      'All active Group permissions are checked; deleted prescriptions excluded')

    const allAllowed = await authorize({
      ...base,
      sessionId: 'session-a',
      authorizeGroup: async (groupId) => groupId === 'group-a' || groupId === 'group-private',
    })
    assert.equal(allAllowed, true, 'Authorized Team plus every H4A Group may read')
  } finally {
    sqlite.close()
  }
})

test('KAN-879 RED-11 getSessionById and existing read paths share the checked scope boundary', () => {
  const source = readFileSync('app/actions/session-actions.ts', 'utf8')
  assert.match(source, /import \{ authorizeSessionReadScope \} from ['"]@\/lib\/sessions\/authorized-session-read-scope['"]/)
  const begin = source.indexOf('async function authorizeSessionRead(')
  const end = source.indexOf('export async function getSessionsByTeam(', begin)
  assert.ok(begin >= 0 && end > begin)
  const boundary = source.slice(begin, end)
  assert.match(boundary, /authorizeSessionReadScope\(/,
    'The actual Session read authorization must use the same tested boundary')
  const read = source.slice(source.indexOf('export async function getSessionById('),
    source.indexOf('export async function getSessionGenerationExplanationReview('))
  assert.match(read, /authorizeSessionRead\(sessionId, planningAccess\)/,
    'Authenticated Session detail reads must retain the existing read guard')
  assert.match(read, /projectVerticalPrescriptionRead\(/,
    'GREEN-9 version-safe vertical projection must remain behind authorization')
})
