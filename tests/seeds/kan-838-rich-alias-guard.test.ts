import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

test('KAN-838 S6 RED: rich seed alias dependencies reject unaccredited targets before writes', () => {
  const root = resolve(process.cwd())
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
  const commands = [
    ['db:seed:race-catalog', 'db/seeds/race-catalog-fixtures.ts'],
    ['db:seed:realized-training', 'db/seeds/realized-training-fixtures.ts'],
    ['db:seed:plan-real', 'db/seeds/plan-real-comparison-fixtures.ts'],
  ] as const
  assert.equal(pkg.scripts['db:seed'],
    'pn db:seed:demo && pn db:seed:race-catalog && pn db:seed:realized-training && pn db:seed:plan-real')
  // Static preflight prevents a test itself from executing unguarded mutation scripts.
  for (const [command, file] of commands) {
    assert.equal(pkg.scripts[command], `tsx ${file}`, `unexpected alias ${command}`)
    const source = readFileSync(join(root, file), 'utf8')
    assert.match(source, /assertAccreditedScenarioSeedTarget\(\)/,
      `${command} must invoke the KAN-834 destination guard before writes`)
  }

  const workspace = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  const sqlitePath = join(workspace, 'sqlite.db')
  const tsx = resolve(root, 'node_modules/tsx/dist/cli.mjs')
  const env = {
    ...process.env, SQLITE_SCENARIO_MODE: '1', SQLITE_DATABASE_PATH: sqlitePath,
    SQLITE_SEED_DISPOSABLE_ACK: '1', TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json'),
  }
  const run = (file: string, e: NodeJS.ProcessEnv) => spawnSync(process.execPath,
    [tsx, resolve(root, file)], { cwd: workspace, env: e, encoding: 'utf8', timeout: 120000 })
  try {
    const migration = run('scripts/upgrade-sqlite.ts', env)
    assert.equal(migration.status, 0, `migration failed: ${migration.stdout}\n${migration.stderr}`)
    const demo = run('db/seeds/demo.ts', env)
    assert.equal(demo.status, 0, `demo failed: ${demo.stdout}\n${demo.stderr}`)
    const snapshot = () => {
      const db = new Database(sqlitePath, { readonly: true, fileMustExist: true })
      try {
        const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[])
        return tables.map(({ name }) => ({ name, rows: db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all() }))
      } finally { db.close() }
    }
    for (const [, file] of commands) {
      const before = snapshot()
      const denied = run(file, { ...env, SQLITE_SEED_DISPOSABLE_ACK: '0' })
      assert.notEqual(denied.status, null, `${file} must execute`)
      assert.notEqual(denied.status, 0, `${file} must DENY`)
      assert.match(`${denied.stdout}\n${denied.stderr}`,
        /KAN-834: isolated seed target is not explicitly accredited as disposable/,
        `${file} requires the exact destination-guard DENY, not arbitrary failure`)
      assert.deepEqual(snapshot(), before, `${file} must not mutate any rows on DENY`)
    }
  } finally { rmSync(workspace, { recursive: true, force: true }) }
})
