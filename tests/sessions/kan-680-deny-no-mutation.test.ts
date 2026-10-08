import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

import { executeAuthorizedSessionMutation } from '@/lib/sessions/authorized-session-mutation'

test('KAN-680 DENY without planning.manage preserves session and prescriptions', async () => {
  await check(['team_1_S2', 'team_1_M1'], [], false)
})

test('KAN-680 partial group coverage DENY preserves prior and resulting group rows', async () => {
  await check(['team_1_S2', 'team_1_M1'], ['team_1_S2'], false)
})

test('KAN-680 full coverage permits one atomic authorized mutation', async () => {
  await check(['team_1_S2', 'team_1_M1'], ['team_1_S2', 'team_1_M1'], true)
})

async function check(
  existing: string[],
  allowedGroups: string[],
  expectedAllowed: boolean,
) {
  const root = mkdtempSync(join(tmpdir(), 'kan680-no-mutation-'))
  const sqlite = new Database(join(root, 'test.sqlite'))
  try {
    sqlite.exec(`
      CREATE TABLE sessions(id TEXT PRIMARY KEY, notes TEXT NOT NULL);
      CREATE TABLE prescriptions(id TEXT PRIMARY KEY, session_id TEXT NOT NULL, group_id TEXT NOT NULL, notes TEXT NOT NULL);
      INSERT INTO sessions VALUES ('shared', 'before');
      INSERT INTO prescriptions VALUES ('s2', 'shared', 'team_1_S2', 'before-s2');
      INSERT INTO prescriptions VALUES ('m1', 'shared', 'team_1_M1', 'before-m1');
    `)
    const snapshot = () => JSON.stringify({
      session: sqlite.prepare('SELECT * FROM sessions ORDER BY id').all(),
      prescriptions: sqlite.prepare('SELECT * FROM prescriptions ORDER BY id').all(),
    })
    const before = snapshot()
    let writes = 0
    const result = await executeAuthorizedSessionMutation({
      existingGroupIds: existing,
      resultingGroupIds: ['team_1_S2', 'team_1_M1'],
      authorizeGroup: async (groupId: string) => allowedGroups.includes(groupId),
      mutate: () => {
        writes++
        sqlite.transaction(() => {
          sqlite.prepare("UPDATE sessions SET notes='changed' WHERE id='shared'").run()
          sqlite.prepare("UPDATE prescriptions SET notes='changed' WHERE session_id='shared'").run()
        })()
      },
    })
    assert.equal(result, expectedAllowed)
    assert.equal(writes, expectedAllowed ? 1 : 0)
    if (!expectedAllowed) assert.equal(snapshot(), before)
    else assert.notEqual(snapshot(), before)
  } finally {
    sqlite.close()
    rmSync(root, { recursive: true, force: true })
  }
}
