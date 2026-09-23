import { migrateCompetitionEntriesSqlite } from '@/db/migrations/competition-entries-sqlite'
import { migrateMacrocycleTargetRaceDateSqlite } from '@/db/migrations/macrocycle-target-race-date-sqlite'
import { migratePlanningCohortsSqlite } from '@/db/migrations/planning-cohorts-sqlite'
import { migrateRealizedTrainingTimingSqlite } from '@/db/migrations/realized-training-timing-sqlite'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'

const require = createRequire(import.meta.url)
const tsxCli = require.resolve('tsx/cli')
const drizzleKitCli = process.platform === 'win32' ? 'drizzle-kit.cmd' : 'drizzle-kit'

function runNode(args: string[]): void {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function runDrizzleKit(args: string[]): void {
  const result = spawnSync(drizzleKitCli, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function classifyExistingSqlite(): 'fresh' | 'versioned' | 'legacy' | 'unrecognized' {
  if (!existsSync('sqlite.db')) return 'fresh'

  const sqlite = new Database('sqlite.db', { fileMustExist: true })
  try {
    const tables = new Set(
      (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
        .map(row => row.name),
    )
    const applicationTables = [...tables].filter(name => !name.startsWith('sqlite_') && name !== '__drizzle_migrations')
    if (applicationTables.length === 0) return 'fresh'

    const hasMigrationMetadata = tables.has('__drizzle_migrations')
    const hasFieldPerformanceTests = tables.has('field_performance_tests')
    const fieldPerformanceColumns = hasFieldPerformanceTests
      ? new Set(
          (sqlite.prepare('PRAGMA table_info(field_performance_tests)').all() as { name: string }[])
            .map(row => row.name),
        )
      : new Set<string>()

    if (hasMigrationMetadata && hasFieldPerformanceTests && !fieldPerformanceColumns.has('recorded_by_user_id')) {
      throw new Error(
        'SQLite state is inconsistent: versioned migration metadata exists but field_performance_tests.recorded_by_user_id is missing; reject automatic migration and use the documented recovery path',
      )
    }

    if (hasMigrationMetadata && tables.has('microcycle_intensity_targets')) {
      const intensityColumns = new Set(
        (sqlite.prepare('PRAGMA table_info(microcycle_intensity_targets)').all() as { name: string }[])
          .map(row => row.name),
      )
      if (
        !intensityColumns.has('reference_percentage_target') ||
        intensityColumns.has('pam_percentage_target')
      ) {
        throw new Error(
          'SQLite state is inconsistent: microcycle_intensity_targets.reference_percentage_target is missing or legacy pam_percentage_target remains; refusing automatic migration without an explicitly approved test-data reset',
        )
      }
    }

    if (hasMigrationMetadata) return 'versioned'

    const reviewedLegacyTables = ['workout_logs', 'group_training_plans', 'macrocycles']
    const isReviewedLegacy = reviewedLegacyTables.every(table => tables.has(table))
    return isReviewedLegacy ? 'legacy' : 'unrecognized'
  } finally {
    sqlite.close()
  }
}

function establishCanonicalMigrationMetadata(
  sqlite: Database.Database,
  appliedThroughTag?: string,
): void {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created_at NUMERIC)`)

  const journal = JSON.parse(
    readFileSync(resolve('drizzle/sqlite/meta/_journal.json'), 'utf8'),
  ) as { entries: Array<{ tag: string; when: number }> }
  const appliedCount =
    appliedThroughTag === undefined
      ? journal.entries.length
      : journal.entries.findIndex(entry => entry.tag === appliedThroughTag) + 1

  if (appliedThroughTag !== undefined && appliedCount === 0) {
    throw new Error(`SQLite migration journal is missing canonical tag ${appliedThroughTag}`)
  }

  const existing = sqlite.prepare(
    'SELECT hash FROM __drizzle_migrations WHERE created_at = ?',
  )
  const insert = sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')

  for (const entry of journal.entries.slice(0, appliedCount)) {
    const migrationPath = resolve('drizzle/sqlite', `${entry.tag}.sql`)
    const sql = readFileSync(migrationPath, 'utf8')
    const hash = createHash('sha256').update(sql).digest('hex')
    const row = existing.get(entry.when) as { hash: string } | undefined
    if (row) {
      if (row.hash !== hash) {
        throw new Error(
          `SQLite migration metadata conflict at canonical timestamp ${entry.when}`,
        )
      }
      continue
    }

    insert.run(hash, entry.when)
  }
}

function reconcileVersionedHeadMetadata(): boolean {
  const verification = spawnSync(process.execPath, [tsxCli, resolve('scripts/verify-sqlite.ts')], {
    stdio: 'ignore',
  })
  if (verification.status !== 0) return false

  const sqlite = new Database('sqlite.db', { fileMustExist: true })
  try {
    sqlite.transaction(() => {
      establishCanonicalMigrationMetadata(sqlite)
    })()
  } finally {
    sqlite.close()
  }

  return true
}

const state = classifyExistingSqlite()
if (state === 'unrecognized') {
  throw new Error(
    'Unrecognized SQLite schema; refusing automatic migration before destructive mutation',
  )
}

if (state === 'fresh') {
  runDrizzleKit([
    'push',
    '--config=drizzle.sqlite.config.ts',
  ])

  const sqlite = new Database('sqlite.db', { fileMustExist: true })
  try {
    establishCanonicalMigrationMetadata(sqlite)
  } finally {
    sqlite.close()
  }

  runNode([tsxCli, resolve('scripts/verify-sqlite.ts')])
  process.exit(0)
}

if (state === 'versioned' && reconcileVersionedHeadMetadata()) {
  runNode([tsxCli, resolve('scripts/verify-sqlite.ts')])
  process.exit(0)
}

if (state === 'legacy') {
  const sqlite = new Database('sqlite.db', { fileMustExist: true })
  try {
    migrateRealizedTrainingTimingSqlite(sqlite)

    sqlite.transaction(() => {
      migratePlanningCohortsSqlite(sqlite)
      migrateCompetitionEntriesSqlite(sqlite)
      migrateMacrocycleTargetRaceDateSqlite(sqlite)
      establishCanonicalMigrationMetadata(sqlite, '0001_realized_training_timing')

      if ((sqlite.pragma('foreign_key_check') as unknown[]).length > 0) {
        throw new Error('Legacy SQLite reconciliation failed foreign-key verification')
      }
    })()
  } finally {
    sqlite.close()
  }
}

runDrizzleKit([
  'migrate',
  '--config=drizzle.sqlite.config.ts',
])
runNode([tsxCli, resolve('scripts/verify-sqlite.ts')])
