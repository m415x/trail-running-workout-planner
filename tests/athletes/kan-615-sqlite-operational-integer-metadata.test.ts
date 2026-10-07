import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

import { migrateKan615Historical0015 } from './kan-615-historical-0015'
import { seedKan615PreservationData } from './kan-615-preservation-seed'

const require = createRequire(import.meta.url)
const tsxCli = require.resolve('tsx/cli')

function snapshot(db: Database.Database) {
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table'
    ORDER BY name
  `).all() as Array<{ name: string }>

  return {
    schema: db.prepare(`
      SELECT type, name, tbl_name, sql
      FROM sqlite_master
      ORDER BY type, name
    `).all(),
    data: Object.fromEntries(tables.map(({ name }) => [
      name,
      db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all(),
    ])),
  }
}

test('KAN-615 reruns applied 0016 with canonical INTEGER metadata', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kan615-rerun-'))
  const databasePath = join(directory, 'scenario.sqlite')

  try {
    const setup = new Database(databasePath)
    try {
      setup.pragma('foreign_keys = ON')
      migrateKan615Historical0015(setup)
      seedKan615PreservationData(setup)
      assert.deepEqual(setup.pragma('foreign_key_check'), [])
    } finally {
      setup.close()
    }

    const runUpgrade = () => spawnSync(
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

    const assertExecution = (
      execution: ReturnType<typeof runUpgrade>,
      label: string,
    ) => {
      assert.equal(
        execution.error,
        undefined,
        `${label}: execution failed`,
      )
      assert.equal(
        execution.status,
        0,
        `${label} failed:\n${execution.stdout}\n${execution.stderr}`,
      )
    }

    assertExecution(runUpgrade(), 'First upgrade')

    const journal = JSON.parse(
      readFileSync('drizzle/sqlite/meta/_journal.json', 'utf8'),
    ) as {
      entries: Array<{ tag: string; when: number }>
    }

    const entry = journal.entries[16]
    assert.equal(entry.tag, '0016_athlete_profile_identity')

    const hash = createHash('sha256')
      .update(readFileSync(`drizzle/sqlite/${entry.tag}.sql`, 'utf8').replace(/\r\n/g, '\n'))
      .digest('hex')

    // Convert only the temporary metadata table to canonical
    // INTEGER AUTOINCREMENT form after a successful 0016 upgrade.
    const conversionDb = new Database(databasePath)

    try {
      conversionDb.pragma('foreign_keys = ON')

      conversionDb.transaction(() => {
        conversionDb.exec(`
          CREATE TABLE "__kan615_integer_metadata" (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hash TEXT NOT NULL,
            created_at NUMERIC
          );

          INSERT INTO "__kan615_integer_metadata" (hash, created_at)
          SELECT hash, created_at
          FROM "__drizzle_migrations"
          ORDER BY rowid;

          DROP TABLE "__drizzle_migrations";

          ALTER TABLE "__kan615_integer_metadata"
            RENAME TO "__drizzle_migrations";
        `)
      })()

      const identifiers = conversionDb.prepare(
        'SELECT id FROM __drizzle_migrations ORDER BY rowid',
      ).all() as Array<{ id: number }>

      assert.deepEqual(
        identifiers.map(row => row.id),
        Array.from({ length: journal.entries.length }, (_, index) => index + 1),
      )

      assert.deepEqual(conversionDb.pragma('foreign_key_check'), [])
    } finally {
      conversionDb.close()
    }

    const firstDb = new Database(databasePath, {
      readonly: true,
      fileMustExist: true,
    })

    let firstSnapshot: ReturnType<typeof snapshot>

    try {
      const history = firstDb.prepare(`
        SELECT hash, created_at FROM __drizzle_migrations
        ORDER BY rowid
      `).all() as Array<{ hash: string; created_at: number }>

      assert.equal(history.length, journal.entries.length)
      assert.deepEqual(history[16], {
        hash,
        created_at: entry.when,
      })

      firstSnapshot = snapshot(firstDb)
      assert.deepEqual(firstDb.pragma('foreign_key_check'), [])
    } finally {
      firstDb.close()
    }

    assertExecution(runUpgrade(), 'Second upgrade')

    const secondDb = new Database(databasePath, {
      readonly: true,
      fileMustExist: true,
    })

    try {
      assert.deepEqual(snapshot(secondDb), firstSnapshot)
      assert.deepEqual(secondDb.pragma('foreign_key_check'), [])
    } finally {
      secondDb.close()
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
