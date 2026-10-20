import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

test('KAN-837 S5: demo retains two distinct H4B S2/M1 shared prescriptions', () => {
  const root = resolve(process.cwd())
  const workspace = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  const path = join(workspace, 'sqlite.db')
  const cli = resolve(root, 'node_modules/tsx/dist/cli.mjs')
  const env = { ...process.env, SQLITE_SCENARIO_MODE: '1', SQLITE_DATABASE_PATH: path,
    SQLITE_SEED_DISPOSABLE_ACK: '1', TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json') }
  const run = (file: string) => spawnSync(process.execPath, [cli, resolve(root, file)],
    { cwd: workspace, env, encoding: 'utf8', timeout: 120000 })
  try {
    const migration = run('scripts/upgrade-sqlite.ts')
    assert.equal(migration.status, 0, `migration failed: ${migration.stdout}\n${migration.stderr}`)
    const seeded = run('db/seeds/demo.ts')
    assert.equal(seeded.status, 0, `demo failed: ${seeded.stdout}\n${seeded.stderr}`)
    const db = new Database(path, { readonly: true, fileMustExist: true })
    try {
      const rows = db.prepare(`
        SELECT s.id AS session_id, s.team_id, s.generation_ownership,
          p.id AS prescription_id, p.group_id, p.microcycle_id,
          g.team_id AS group_team_id, gp.group_id AS plan_group_id,
          s.date AS session_date, mi.start_date, mi.end_date
        FROM sessions s
        JOIN group_session_prescriptions p ON p.session_id = s.id
        JOIN athlete_groups g ON g.id = p.group_id
        JOIN microcycles mi ON mi.id = p.microcycle_id
        JOIN mesocycles me ON me.id = mi.mesocycle_id
        JOIN macrocycles ma ON ma.id = me.macrocycle_id
        JOIN group_training_plans gp ON gp.id = ma.group_training_plan_id
        WHERE s.id = 'accept_h4b_shared_session' AND s.is_deleted = 0 AND p.is_deleted = 0
      `).all() as Array<{
        session_id: string; team_id: string; generation_ownership: string;
        prescription_id: string; group_id: string; microcycle_id: string;
        group_team_id: string; plan_group_id: string;
        session_date: string; start_date: string; end_date: string
      }>
      assert.equal(rows.length, 2, 'exactly two H4B prescriptions are required')
      assert.deepEqual(rows.map(row => row.group_id).sort(), ['team_1_M1', 'team_1_S2'])
      assert.equal(new Set(rows.map(row => row.microcycle_id)).size, 2)
      assert.equal(new Set(rows.map(row => row.prescription_id)).size, 2)
      assert.ok(rows.every(row => row.team_id === 'team_1' &&
        row.group_team_id === 'team_1' && row.plan_group_id === row.group_id &&
        row.generation_ownership === 'manual' &&
        row.session_date >= row.start_date && row.session_date <= row.end_date))
      assert.deepEqual(db.pragma('foreign_key_check'), [])
    } finally { db.close() }
  } finally { rmSync(workspace, { recursive: true, force: true }) }
})
