import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import Database from 'better-sqlite3'

test('KAN-833 S1 RED: base bootstraps Team and athletes without planning groups or sessions', () => {
  const root = resolve(process.cwd())
  const workspace = mkdtempSync(join(tmpdir(), 'kan-833-base-contract-'))
  const sqlitePath = join(workspace, 'sqlite.db')
  const tsx = resolve(root, 'node_modules/tsx/dist/cli.mjs')
  const env = {
    ...process.env,
    SQLITE_SCENARIO_MODE: '1',
    SQLITE_DATABASE_PATH: sqlitePath,
    TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json'),
  }
  function execute(script: string): void {
    const result = spawnSync(process.execPath, [tsx, resolve(root, script)], {
      cwd: workspace, env, encoding: 'utf8', timeout: 120000,
    })
    assert.equal(result.status, 0, `${script} failed: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`)
  }
  try {
    execute('scripts/upgrade-sqlite.ts')
    execute('db/seed.ts') // Current implementation of db:seed:base; no production edit in S1.
    const sqlite = new Database(sqlitePath, { readonly: true, fileMustExist: true })
    try {
      const count = (table: string): number => {
        const result = sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }
        return result.n
      }
      assert.ok(count('teams') > 0, 'base must retain the structural Team')
      assert.ok(count('athlete_profiles') > 0, 'base must retain sample Athlete profiles')
      assert.equal(count('athlete_groups'), 0, 'base must leave athletes ungrouped')
      assert.equal(count('group_training_plans'), 0, 'base must not create plans')
      assert.equal(count('sessions'), 0, 'base must not create sessions')
      assert.equal(count('group_session_prescriptions'), 0, 'base must not create prescriptions')
      assert.deepEqual(sqlite.pragma('foreign_key_check'), [], 'base must preserve referential integrity')
    } finally {
      sqlite.close()
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})
