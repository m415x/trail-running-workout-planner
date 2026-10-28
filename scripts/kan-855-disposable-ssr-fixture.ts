import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import Database from 'better-sqlite3'

const root = resolve(import.meta.dirname, '..')
const projectDb = resolve(root, 'sqlite.db')
const tsconfig = resolve(root, 'tsconfig.json')
const tsxCli = resolve(root, 'node_modules/tsx/dist/cli.mjs')
const hash = (path: string) => existsSync(path)
  ? createHash('sha256').update(readFileSync(path)).digest('hex')
  : 'absent'
const initialHash = hash(projectDb)
const dir = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-kan855-'))
const path = join(dir, 'sqlite.db')
const env = {
  ...process.env,
  SQLITE_SCENARIO_MODE: '1',
  SQLITE_SEED_DISPOSABLE_ACK: '1',
  SQLITE_DATABASE_PATH: path,
  TSX_TSCONFIG_PATH: tsconfig,
  NODE_ENV: 'test',
}
function run(script: string) {
  const result = spawnSync(process.execPath, [tsxCli, resolve(root, script)], {
    cwd: dir, env, encoding: 'utf8', timeout: 180_000,
  })
  if (result.error || result.status !== 0) {
    throw new Error(script + ': ' + (result.error?.message ?? result.stderr.slice(-1600)))
  }
}
let phase = 'init'
try {
  // Canonical upgrader detects fresh DB and creates all tables and versioned metadata.
  run('scripts/upgrade-sqlite.ts')
  phase = 'schema'
  run('scripts/verify-sqlite.ts')
  phase = 'verified_schema'
  // KAN-838 owns the staged demo/H4B seed and its destination guards.
  run('scripts/seed-acceptance-disposable.ts')
  phase = 'seeded'
  run('scripts/verify-sqlite.ts')
  const db = new Database(path, { fileMustExist: true, readonly: true })
  try {
    db.pragma('query_only = ON')
    const tables = ['users', 'external_identity_links', 'team_memberships', 'teams', 'athlete_profiles']
    const results = Object.fromEntries(tables.map(name => {
      const count = db.prepare('SELECT count(*) AS n FROM "' + name + '"').get() as {n: number}
      return [name, count.n]
    }))
    const journal = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'").get() as {n: number}
    const foreignKeyErrors = (db.pragma('foreign_key_check') as unknown[]).length
    const integrity = db.pragma('integrity_check') as Array<{integrity_check: string}>
    if (foreignKeyErrors !== 0 || integrity.some(row => row.integrity_check !== 'ok')) throw new Error('SQLite integrity failed')
    if (Object.values(results).some(count => count === 0)) throw new Error('Required acceptance table empty')
    if (journal.n !== 1) throw new Error('Canonical migration journal missing')
    console.log(JSON.stringify({
      status: 'SCHEMA_AND_H4B_SEED_READY',
      disposableDatabasePath: path,
      journalPresent: true,
      foreignKeyErrors,
      integrity: 'ok',
      tableCounts: results,
      authenticSupabaseSubjectLinked: false,
      next: 'Authentic subject provisioning requires separate verified collision-safe contract',
    }, null, 2))
  } finally { db.close() }
} catch (error) {
  process.exitCode = 1
  console.error('KAN-855 fixture phase ' + phase + ': ' + (error instanceof Error ? error.message : 'failed'))
  console.error('Disposable target retained for inspection: ' + path)
} finally {
  if (hash(projectDb) !== initialHash) {
    console.error('STOP: developer sqlite.db changed during operation')
    process.exitCode = 1
  }
}
