import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

const HISTORICAL_COUNT = 16
const HISTORICAL_HEAD = '0015_generation_explanation_provenance'
const HISTORICAL_TIMESTAMP = 1790802000000

export function migrateKan615Historical0015(
  sqlite: Database.Database,
): void {
  const root = resolve(process.cwd(), 'drizzle/sqlite')
  const journal = JSON.parse(
    readFileSync(join(root, 'meta/_journal.json'), 'utf8'),
  ) as {
    version: string
    dialect: string
    entries: Array<{
      idx: number
      version: string
      when: number
      tag: string
      breakpoints: boolean
    }>
  }

  const historical = journal.entries.slice(0, HISTORICAL_COUNT)

  if (
    historical.length !== HISTORICAL_COUNT ||
    historical.at(-1)?.tag !== HISTORICAL_HEAD ||
    historical.at(-1)?.when !== HISTORICAL_TIMESTAMP ||
    historical.some((entry, index) => entry.idx !== index)
  ) {
    throw new Error('KAN-615 historical 0015 migration contract drift')
  }

  const directory = mkdtempSync(
    join(tmpdir(), 'kan-615-historical-0015-'),
  )

  try {
    mkdirSync(join(directory, 'meta'))

    writeFileSync(
      join(directory, 'meta/_journal.json'),
      JSON.stringify({
        version: journal.version,
        dialect: journal.dialect,
        entries: historical,
      }),
    )

    for (const entry of historical) {
      copyFileSync(
        join(root, `${entry.tag}.sql`),
        join(directory, `${entry.tag}.sql`),
      )
    }

    migrate(drizzle(sqlite), {
      migrationsFolder: directory,
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}
