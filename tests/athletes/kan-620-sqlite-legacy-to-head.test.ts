import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

const require = createRequire(import.meta.url)
const tsxCli = require.resolve('tsx/cli')

test('KAN-620 upgrades representative legacy SQLite through current journal head', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kan620-legacy-head-'))
  const databasePath = join(directory, 'scenario.sqlite')

  try {
    const sqlite = new Database(databasePath)
    try {
      sqlite.exec(readFileSync('drizzle/sqlite/0000_baseline.sql', 'utf8'))
    } finally {
      sqlite.close()
    }

    const execution = spawnSync(
      process.execPath,
      [tsxCli, resolve('scripts/upgrade-sqlite.ts')],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          SQLITE_SCENARIO_MODE: '1',
          SQLITE_DATABASE_PATH: databasePath,
        },
        encoding: 'utf8',
        timeout: 120000,
        maxBuffer: 4 * 1024 * 1024,
      },
    )

    assert.equal(
      execution.error,
      undefined,
      `legacy-to-head execution failed: ${execution.error}`,
    )
    assert.equal(
      execution.status,
      0,
      `legacy-to-head upgrade failed:\n${execution.stdout}\n${execution.stderr}`,
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
