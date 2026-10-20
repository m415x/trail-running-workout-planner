import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

test('KAN-836 S4 RED: plan creates cohort Variant derived from direct Base with no effective sessions', () => {
  const root = resolve(process.cwd())
  const workspace = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  const sqlitePath = join(workspace, 'sqlite.db')
  const cli = resolve(root, 'node_modules/tsx/dist/cli.mjs')
  const env = { ...process.env, SQLITE_SCENARIO_MODE: '1', SQLITE_DATABASE_PATH: sqlitePath,
    SQLITE_SEED_DISPOSABLE_ACK: '1', TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json') }
  const run = (file: string) => spawnSync(process.execPath, [cli, resolve(root, file)],
    { cwd: workspace, env, encoding: 'utf8', timeout: 120000 })
  try {
    const migrated = run('scripts/upgrade-sqlite.ts')
    assert.equal(migrated.status, 0, `migration failed: ${migrated.stdout}\n${migrated.stderr}`)
    for (let attempt = 0; attempt < 2; attempt++) {
      const seeded = run('db/seeds/plan.ts')
      assert.equal(seeded.status, 0, `plan failed: ${seeded.stdout}\n${seeded.stderr}`)
      const db = new Database(sqlitePath, { readonly: true, fileMustExist: true })
      try {
        const base = db.prepare("SELECT id, group_id, planning_cohort_id, source_group_training_plan_id FROM group_training_plans WHERE id = 'group_plan_s2_12k'").get() as { id: string; group_id: string; planning_cohort_id: string | null; source_group_training_plan_id: string | null } | undefined
        assert.ok(base, 'S2 direct Base plan must exist')
        assert.equal(base.planning_cohort_id, null)
        assert.equal(base.source_group_training_plan_id, null)
        const variants = db.prepare('SELECT id, group_id, planning_cohort_id, source_group_training_plan_id FROM group_training_plans WHERE source_group_training_plan_id = ?').all(base.id) as Array<{ id: string; group_id: string; planning_cohort_id: string | null; source_group_training_plan_id: string | null }>
        assert.equal(variants.length, 1, 'plan must contain one direct S2 cohort Variant')
        assert.equal(variants[0].group_id, base.group_id)
        assert.equal(variants[0].planning_cohort_id, 'planning_cohort_s2_short_trail')
        assert.equal(variants[0].source_group_training_plan_id, base.id)
        const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n
        assert.equal(count('sessions'), 0)
        assert.equal(count('group_session_prescriptions'), 0)
        assert.deepEqual(db.pragma('foreign_key_check'), [])
      } finally { db.close() }
    }
  } finally { rmSync(workspace, { recursive: true, force: true }) }
})
