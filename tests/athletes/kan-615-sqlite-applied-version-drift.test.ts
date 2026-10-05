import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

import { migrateKan615Historical0015 } from './kan-615-historical-0015'
import { seedKan615PreservationData } from './kan-615-preservation-seed'
import {
  migrateAthleteProfileIdentitySqlite,
} from '../../db/migrations/athlete-profile-identity-sqlite'

const require = createRequire(import.meta.url)
const tsxCli = require.resolve('tsx/cli')

function snapshot(sqlite: Database.Database) {
  const schema = sqlite.prepare(`
    SELECT type, name, tbl_name, sql
    FROM sqlite_master
    ORDER BY type, name
  `).all()

  const tables = sqlite.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table'
    ORDER BY name
  `).all() as Array<{ name: string }>

  const data = Object.fromEntries(
    tables.map(({ name }) => [
      name,
      sqlite.prepare(
        `SELECT * FROM "${name}" ORDER BY rowid`,
      ).all(),
    ]),
  )

  return { schema, data }
}

test('KAN-615 refuses to repair missing 0016 metadata on migrated physical schema', () => {
  const directory = mkdtempSync(
    join(tmpdir(), 'kan615-applied-drift-'),
  )
  const databasePath = join(directory, 'scenario.sqlite')

  try {
    const setup = new Database(databasePath)

    try {
      setup.pragma('foreign_keys = ON')
      migrateKan615Historical0015(setup)
      seedKan615PreservationData(setup)

      // Build a legitimate destination before introducing drift.
      migrateAthleteProfileIdentitySqlite(setup)

      const removed = setup.prepare(`
        DELETE FROM __drizzle_migrations
        WHERE created_at = ?
      `).run(1790802001000)

      assert.equal(removed.changes, 1)
      assert.equal(
        (
          setup.prepare(`
            SELECT COUNT(*) AS count
            FROM __drizzle_migrations
          `).get() as { count: number }
        ).count,
        16,
      )

      const columns = setup.pragma(
        'table_info(athlete_profiles)',
      ) as Array<{ name: string; notnull: number }>

      assert.equal(
        columns.find(column => column.name === 'user_id')
          ?.notnull,
        0,
      )
      assert.deepEqual(setup.pragma('foreign_key_check'), [])
    } finally {
      setup.close()
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
        timeout: 120000,
        maxBuffer: 4 * 1024 * 1024,
      },
    )

    assert.equal(execution.error, undefined)

    assert.notEqual(
      execution.status,
      0,
      'Missing 0016 metadata must not be reconciled automatically',
    )

    const output =
      `${execution.stdout ?? ''}\n${execution.stderr ?? ''}`

    assert.match(
      output,
      /AthleteProfile incompatible applied 0016/i,
      'Expected explicit applied-version integrity rejection',
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
