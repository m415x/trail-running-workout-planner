import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

const projectRoot = resolve(import.meta.dirname, '../..')
const launcher = resolve(projectRoot, 'scripts/acceptance-dev.ts')
const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')

test('KAN-885/T3 CLI --db invokes read-only physical preflight before any server launch', () => {
  const directory = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  try {
    const databasePath = join(directory, 'incomplete.db')
    const sqlite = new Database(databasePath)
    try {
      sqlite.exec('CREATE TABLE unrelated (id TEXT PRIMARY KEY)')
    } finally {
      sqlite.close()
    }

    const before = readFileSync(databasePath)
    const result = spawnSync(process.execPath, [tsxCli, launcher, '--db', databasePath], {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 10_000,
    })

    assert.equal(result.error, undefined)
    assert.notEqual(result.status, 0, 'incompatible SQLite must never launch Next')
    assert.match(result.stderr, /physical SQLite schema missing table users/i,
      'the CLI must invoke existing physical preflight, not just path accreditation')
    assert.deepEqual(readFileSync(databasePath), before, 'preflight must not mutate SQLite')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
