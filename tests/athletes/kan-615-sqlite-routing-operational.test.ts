import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import test from 'node:test'
import Database from 'better-sqlite3'

import { migrateKan615Historical0015 } from './kan-615-historical-0015'
import { seedKan615PreservationData } from './kan-615-preservation-seed'

const require = createRequire(import.meta.url)
const tsxCli = require.resolve('tsx/cli')

function snapshot(sqlite: Database.Database) {
  const tables = sqlite.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all() as Array<{ name: string }>

  return {
    schema: sqlite.prepare(`
      SELECT type, name, tbl_name, sql
      FROM sqlite_master
      ORDER BY type, name
    `).all(),

    data: Object.fromEntries(tables.map(({ name }) => [
      name,
      sqlite.prepare(
        `SELECT * FROM "${name}" ORDER BY rowid`,
      ).all(),
    ])),
  }
}

test('KAN-615 operational upgrade rejects tampered 0015 without mutation', () => {
  const directory = mkdtempSync(
    join(tmpdir(), 'kan615-routing-drift-'),
  )
  const databasePath = join(directory, 'scenario.sqlite')

  try {
    const sqlite = new Database(databasePath)

    try {
      sqlite.pragma('foreign_keys = ON')
      migrateKan615Historical0015(sqlite)
      seedKan615PreservationData(sqlite)

      const update = sqlite.prepare(`
        UPDATE __drizzle_migrations
        SET hash = ?
        WHERE created_at = ?
      `).run(
        'kan615-intentionally-corrupted-hash',
        1790802000000,
      )

      assert.equal(update.changes, 1)
      assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
    } finally {
      sqlite.close()
    }

    const beforeDb = new Database(databasePath, {
      readonly: true,
      fileMustExist: true,
    })

    let before: ReturnType<typeof snapshot>

    try {
      before = snapshot(beforeDb)
    } finally {
      beforeDb.close()
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
        timeout: 30000,
      },
    )

    assert.equal(
      execution.error,
      undefined,
      `Could not execute temporary scenario: ${execution.error}`,
    )

    assert.notEqual(
      execution.status,
      0,
      'Tampered 0015 must not complete the upgrade',
    )

    const output =
      `${execution.stdout ?? ''}\n${execution.stderr ?? ''}`

    assert.match(
      output,
      /AthleteProfile incompatible versioned origin/i,
      'The rejection must originate from strict KAN-615 preflight',
    )

    const afterDb = new Database(databasePath, {
      readonly: true,
      fileMustExist: true,
    })

    try {
      assert.deepEqual(snapshot(afterDb), before)
      assert.deepEqual(afterDb.pragma('foreign_key_check'), [])
    } finally {
      afterDb.close()
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
