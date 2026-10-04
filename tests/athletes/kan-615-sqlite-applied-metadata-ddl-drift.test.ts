import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
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

  return {
    schema,
    data: Object.fromEntries(
      tables.map(({ name }) => [
        name,
        sqlite.prepare(
          `SELECT * FROM "${name}" ORDER BY rowid`,
        ).all(),
      ]),
    ),
  }
}

test('KAN-615 rejects applied 0016 with unauthorized metadata column', () => {
  const directory = mkdtempSync(
    join(tmpdir(), 'kan615-metadata-ddl-drift-'),
  )
  const databasePath = join(directory, 'scenario.sqlite')

  try {
    const setup = new Database(databasePath)

    try {
      setup.pragma('foreign_keys = ON')
      migrateKan615Historical0015(setup)
      seedKan615PreservationData(setup)
      migrateAthleteProfileIdentitySqlite(setup)

      const history = setup.prepare(`
        SELECT COUNT(*) AS count FROM __drizzle_migrations
      `).get() as { count: number }

      assert.equal(history.count, 17)

      setup.exec(
        'ALTER TABLE "__drizzle_migrations" ADD COLUMN kan615_rogue TEXT',
      )

      const metadataColumns = setup.pragma(
        'table_info(__drizzle_migrations)',
      ) as Array<{ name: string }>

      assert.ok(metadataColumns.some(
        column => column.name === 'kan615_rogue',
      ))

      const metadataHistoryCount = setup.prepare(
        'SELECT COUNT(*) AS count FROM __drizzle_migrations',
      ).get() as { count: number }

      assert.equal(metadataHistoryCount.count, 17)

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

    assert.equal(
      execution.error,
      undefined,
      `Scenario execution error: ${execution.error}`,
    )

    assert.notEqual(
      execution.status,
      0,
      'Applied 0016 with altered metadata DDL must be rejected',
    )

    const output =
      `${execution.stdout ?? ''}\n${execution.stderr ?? ''}`

    assert.match(
      output,
      /AthleteProfile incompatible applied 0016/i,
      'Expected deliberate physical-integrity rejection',
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
