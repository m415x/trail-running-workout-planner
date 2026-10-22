#!/usr/bin/env node
// KAN-849 disposable acceptance bootstrap. No dependency on shell export or developer sqlite.db.
import { mkdtempSync, existsSync, writeFileSync, realpathSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
if (!root.toLowerCase().endsWith('trail-running-workout-planner-kan-849-exp')) {
  throw new Error('KAN-849 requires disposable experimental worktree')
}
if (process.env.NODE_ENV === 'production' || process.env.CI === 'true') {
  throw new Error('KAN-849 acceptance bootstrap forbidden in production/CI')
}
const temp = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
const database = join(temp, 'sqlite.db')
const config = resolve(root, 'tsconfig.json')
const tsx = resolve(root, 'node_modules/tsx/dist/cli.mjs')
if (!existsSync(tsx) || !existsSync(config)) throw new Error('Missing installed tsx or project config')
const env = {
  ...process.env,
  SQLITE_SCENARIO_MODE: '1',
  SQLITE_SEED_DISPOSABLE_ACK: '1',
  SQLITE_DATABASE_PATH: database,
  TSX_TSCONFIG_PATH: config,
  EPT_IDENTITY_BACKEND: 'sqlite',
}
function run(script) {
  const child = spawnSync(process.execPath, [tsx, resolve(root, script)], {
    cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 180000,
  })
  if (child.error || child.status !== 0) {
    process.stderr.write((child.stdout ?? '') + '\n' + (child.stderr ?? '') + '\n')
    throw child.error ?? new Error(script + ' failed (exit=' + child.status + ')')
  }
  process.stdout.write('KAN-849 DISPOSABLE_PHASE_PASS ' + script + '\n')
}
try {
  run('scripts/upgrade-sqlite.ts')
  if (!existsSync(database) || !statSync(database).isFile()) throw new Error('Migration did not create SQLite')
  run('scripts/seed-acceptance-disposable.ts')
  const actual = realpathSync(database)
  if (actual.toLowerCase() === resolve(root, 'sqlite.db').toLowerCase()) throw new Error('Development database collision')
  const state = resolve(root, '.tmp/kan-849-acceptance-db-path.txt')
  // Only an isolated database path is persisted; never auth tokens/credentials.
  writeFileSync(state, actual + '\n', { flag: 'w' })
  process.stdout.write('KAN-849 DISPOSABLE_DB_READY ' + JSON.stringify({ path: actual, state }) + '\n')
} catch (error) {
  process.stderr.write('KAN-849 DISPOSABLE_BOOTSTRAP_FAILED ' + (error instanceof Error ? error.message : String(error)) + '\n')
  process.exitCode = 1
}
