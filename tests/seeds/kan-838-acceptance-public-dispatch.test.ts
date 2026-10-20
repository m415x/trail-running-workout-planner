import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

test('KAN-838 RED: acceptance dispatch must use one guarded orchestration boundary', () => {
  const scripts = (JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as {
    scripts: Record<string, string>
  }).scripts
  assert.equal(
    scripts['db:seed:acceptance'],
    'tsx scripts/seed-acceptance-disposable.ts',
    'the current demo + H4B command chain cannot share scenario accreditation or publish atomically',
  )
})

test('KAN-838: an unaccredited acceptance attempt has an exact DENY and zero SQLite mutations', () => {
  const root = resolve(process.cwd())
  const workspace = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  const path = join(workspace, 'sqlite.db')
  const tsx = resolve(root, 'node_modules/tsx/dist/cli.mjs')
  const run = (script: string, env: NodeJS.ProcessEnv) =>
    spawnSync(process.execPath, [tsx, resolve(root, script)], {
      cwd: workspace, env, encoding: 'utf8', timeout: 120000,
    })
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SQLITE_SCENARIO_MODE: '1',
    SQLITE_DATABASE_PATH: path,
    SQLITE_SEED_DISPOSABLE_ACK: '0',
    TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json'),
  }
  try {
    const upgrade = run('scripts/upgrade-sqlite.ts', { ...env, SQLITE_SEED_DISPOSABLE_ACK: '1' })
    assert.equal(upgrade.status, 0, `migration failed: ${upgrade.stdout}\n${upgrade.stderr}`)
    const snapshot = () => {
      const sqlite = new Database(path, { readonly: true, fileMustExist: true })
      try {
        const tables = sqlite.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        ).all() as Array<{ name: string }>
        return tables.map(({ name }) => ({
          name,
          rows: sqlite.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all(),
        }))
      } finally { sqlite.close() }
    }
    const before = snapshot()
    const denied = run('db/seeds/demo.ts', env)
    assert.notEqual(denied.status, null, 'demo process must execute')
    assert.notEqual(denied.status, 0, 'unaccredited destination must be rejected')
    assert.match(`${denied.stdout}\n${denied.stderr}`,
      /KAN-834: isolated seed target is not explicitly accredited as disposable/,
      'only the exact KAN-834 guard qualifies as causal DENY')
    assert.deepEqual(snapshot(), before, 'denial must preserve every SQLite row')
  } finally { rmSync(workspace, { recursive: true, force: true }) }
})
