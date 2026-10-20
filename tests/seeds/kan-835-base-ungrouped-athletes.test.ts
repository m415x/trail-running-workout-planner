import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { seedTeamAndCoach } from '@/db/seeds/team-and-coach'
import { seedAthletes } from '@/db/seeds/athletes'
import type { db as sqliteDb } from '@/db/index'

test('KAN-835 S3 RED: base athlete fixture supports ungrouped profiles without group seed dependency', async () => {
  const root = resolve(process.cwd())
  const workspace = mkdtempSync(join(tmpdir(), 'kan-835-ungrouped-base-'))
  const sqlitePath = join(workspace, 'sqlite.db')
  const tsx = resolve(root, 'node_modules/tsx/dist/cli.mjs')
  try {
    const migrated = spawnSync(process.execPath, [tsx, resolve(root, 'scripts/upgrade-sqlite.ts')], {
      cwd: workspace,
      env: {
        ...process.env,
        SQLITE_SCENARIO_MODE: '1',
        SQLITE_DATABASE_PATH: sqlitePath,
        TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json'),
      },
      encoding: 'utf8',
      timeout: 120000,
    })
    assert.equal(migrated.status, 0, `isolated migrations failed: ${migrated.stdout}\n${migrated.stderr}`)

    const sqlite = new Database(sqlitePath, { fileMustExist: true })
    try {
      const db = drizzle(sqlite) as unknown as typeof sqliteDb
      await seedTeamAndCoach(db)
      // An empty group collection represents the new base level, not a
      // request to populate planning or the legacy S2/M1 acceptance fixture.
      await seedAthletes(db, [])
      const count = (table: string): number =>
        (sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n
      assert.ok(count('teams') > 0)
      assert.ok(count('athlete_profiles') > 0)
      assert.equal(count('athlete_groups'), 0)
      assert.equal(count('group_training_plans'), 0)
      assert.equal(count('sessions'), 0)
      assert.equal(count('group_session_prescriptions'), 0)
      const assigned = sqlite.prepare('SELECT COUNT(*) AS n FROM athlete_profiles WHERE group_id IS NOT NULL').get() as { n: number }
      assert.equal(assigned.n, 0, 'base athletes must remain ungrouped')
      assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
    } finally {
      sqlite.close()
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})
