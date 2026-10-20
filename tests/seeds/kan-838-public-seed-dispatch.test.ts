import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

test('KAN-838 S6 RED: public seed dispatch is progressive and unauthorized targets fail closed', () => {
  const root = resolve(process.cwd())
  const scripts = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>
  }).scripts
  const expected: Record<string, string> = {
    'db:seed:init': 'tsx db/seeds/init.ts',
    'db:seed:base': 'tsx db/seeds/base.ts',
    'db:seed:plan': 'tsx db/seeds/plan.ts',
    'db:seed:demo': 'tsx db/seeds/demo.ts',
  }
  // Assert dispatch before spawning anything: arbitrary process failures
  // cannot satisfy the public command contract.
  for (const [name, target] of Object.entries(expected)) {
    assert.equal(scripts[name], target, `${name} must dispatch to ${target}`)
  }
  assert.equal(scripts['db:seed:acceptance'], 'tsx scripts/seed-acceptance-disposable.ts',
    'acceptance must dispatch through the approved disposable H4B orchestrator')
  const acceptanceSource = readFileSync(join(root, 'scripts/seed-acceptance-disposable.ts'), 'utf8')
  assert.match(acceptanceSource, /run\('db\/seeds\/demo\.ts'\)/,
    'acceptance orchestrator must stage the historical demo fixtures')
  assert.match(acceptanceSource, /run\('scripts\/provision-h4b-acceptance-actors\.ts', \['--apply'\]\)/,
    'acceptance orchestrator must provision H4B actors after demo')

  const workspace = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  const path = join(workspace, 'sqlite.db')
  const cli = resolve(root, 'node_modules/tsx/dist/cli.mjs')
  const env = {
    ...process.env, SQLITE_SCENARIO_MODE: '1', SQLITE_DATABASE_PATH: path,
    SQLITE_SEED_DISPOSABLE_ACK: '1', TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json'),
  }
  const run = (script: string, environment = env) => spawnSync(process.execPath, [cli, resolve(root, script)], {
    cwd: workspace, env: environment, encoding: 'utf8', timeout: 120000,
  })
  try {
    const migrated = run('scripts/upgrade-sqlite.ts')
    assert.equal(migrated.status, 0, `migration failure: ${migrated.stdout}\n${migrated.stderr}`)

    // Execute the actual package dispatch target, not a parallel handpicked seed.
    const baseTarget = scripts['db:seed:base'].slice('tsx '.length)
    const base = run(baseTarget)
    assert.equal(base.status, 0, `base failed: ${base.stdout}\n${base.stderr}`)
    const snapshot = () => {
      const db = new Database(path, { readonly: true, fileMustExist: true })
      try {
        const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
          .all() as { name: string }[]).map(row => row.name)
        return tables.map(name => ({
          name,
          rows: db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all(),
        }))
      } finally { db.close() }
    }
    const db = new Database(path, { readonly: true, fileMustExist: true })
    try {
      const count = (name: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get() as { n: number }).n
      assert.ok(count('athlete_profiles') > 0, 'base must seed athletes')
      for (const table of ['athlete_groups', 'group_training_plans', 'sessions', 'group_session_prescriptions'])
        assert.equal(count(table), 0, `base must not populate ${table}`)
    } finally { db.close() }
    const before = snapshot()
    const denied = run(baseTarget, { ...env, SQLITE_SEED_DISPOSABLE_ACK: '0' })
    assert.notEqual(denied.status, null, 'the denied command must execute')
    assert.notEqual(denied.status, 0, 'unaccredited alias must fail')
    assert.match(`${denied.stdout}\n${denied.stderr}`,
      /KAN-834: isolated seed target is not explicitly accredited as disposable/,
      'only the specific S2 destination guard qualifies as a DENY')
    assert.deepEqual(snapshot(), before, 'DENY must leave all SQLite rows unchanged')
  } finally { rmSync(workspace, { recursive: true, force: true }) }
})
