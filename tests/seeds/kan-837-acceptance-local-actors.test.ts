import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

test('KAN-837 S5: acceptance actors are explicit local EPT fixtures, not Supabase accounts', () => {
  const root = resolve(process.cwd())
  const workspace = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  const dbPath = join(workspace, 'sqlite.db')
  const cli = resolve(root, 'node_modules/tsx/dist/cli.mjs')
  const scenarioEnv = { ...process.env, SQLITE_SCENARIO_MODE: '1',
    SQLITE_DATABASE_PATH: dbPath, SQLITE_SEED_DISPOSABLE_ACK: '1',
    TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json') }
  const run = (file: string, args: string[], env: NodeJS.ProcessEnv) =>
    spawnSync(process.execPath, [cli, resolve(root, file), ...args], {
      cwd: workspace, env, encoding: 'utf8', timeout: 120000,
    })
  try {
    for (const file of ['scripts/upgrade-sqlite.ts', 'db/seeds/demo.ts']) {
      const result = run(file, [], scenarioEnv)
      assert.equal(result.status, 0, `${file} failed: ${result.stdout}\n${result.stderr}`)
    }
    const actorFile = 'scripts/provision-h4b-acceptance-actors.ts'
    const actorEnv: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'test', CI: 'false',
      SQLITE_SCENARIO_MODE: '', TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json') }
    const inspect = (args: string[]) => {
      const result = run(actorFile, args, actorEnv)
      assert.equal(result.status, 0, `acceptance actors failed: ${result.stdout}\n${result.stderr}`)
      return result.stdout
    }
    assert.match(inspect([]), /"status": "absent"/)
    assert.match(inspect(['--apply']), /four independent local EPT identities provisioned atomically/)
    assert.match(inspect([]), /"status": "complete"/)
    assert.match(inspect(['--apply']), /already provisioned; no mutation/)
    const sqlite = new Database(dbPath, { readonly: true, fileMustExist: true })
    try {
      const rows = sqlite.prepare(`
        SELECT m.preset, m.team_id, m.is_active, m.is_deleted,
          l.provider, l.subject, l.user_id
        FROM team_memberships m
        JOIN external_identity_links l ON l.user_id = m.user_id
        WHERE m.user_id LIKE 'accept_h4b_%'
        ORDER BY m.preset
      `).all() as Array<{ preset: string; team_id: string; is_active: number;
        is_deleted: number; provider: string; subject: string; user_id: string }>
      assert.deepEqual(rows.map(row => row.preset), ['admin', 'assistant', 'athlete', 'coach'])
      assert.equal(new Set(rows.map(row => row.subject)).size, 4)
      assert.ok(rows.every(row => row.team_id === 'team_1' &&
        row.is_active === 1 && row.is_deleted === 0 &&
        row.provider === 'supabase' && row.subject.length > 0))
      assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
    } finally { sqlite.close() }
  } finally { rmSync(workspace, { recursive: true, force: true }) }
})
