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

function run(args: string[]): void {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' })
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

    if (hasMigrationMetadata) return 'versioned'

    const reviewedLegacyTables = ['workout_logs', 'group_training_plans', 'macrocycles']
    const isReviewedLegacy = reviewedLegacyTables.every(table => tables.has(table))
    return isReviewedLegacy ? 'legacy' : 'unrecognized'
  } finally {
    sqlite.close()
  }
}

function establishCanonicalMigrationMetadata(sqlite: Database.Database, appliedCount: number): void {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created_at NUMERIC)`)

  const existing = sqlite.prepare(
    'SELECT hash FROM __drizzle_migrations WHERE created_at = ?',
  )
  const insert = sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')
  const migrations = [
    ['drizzle/sqlite/0000_baseline.sql', 1789348463278],
    ['drizzle/sqlite/0001_realized_training_timing.sql', 1789348503010],
    ['drizzle/sqlite/0002_marvelous_franklin_richards.sql', 1789650330603],
    ['drizzle/sqlite/0003_thin_bastion.sql', 1789866825158],
    ['drizzle/sqlite/0004_mighty_king_cobra.sql', 1789867537434],
    ['drizzle/sqlite/0005_volatile_ultragirl.sql', 1789905666541],
  ] as const

  for (const [migrationPath, createdAt] of migrations.slice(0, appliedCount)) {
    const sql = readFileSync(resolve(migrationPath), 'utf8')
    const hash = createHash('sha256').update(sql).digest('hex')
    const row = existing.get(createdAt) as { hash: string } | undefined
    if (row) {
      if (row.hash !== hash) {
        throw new Error(
          `SQLite migration metadata conflict at canonical timestamp ${createdAt}`,
        )
      }
      continue
    }

    insert.run(hash, createdAt)
  }
}

const state = classifyExistingSqlite()
if (state === 'unrecognized') {
  throw new Error(
    'Unrecognized SQLite schema; refusing automatic migration before destructive mutation',
  )
}

if (state === 'fresh') {
  run([
    require.resolve('drizzle-kit/bin.cjs'),
    'push',
    '--config=drizzle.sqlite.config.ts',
  ])

  const sqlite = new Database('sqlite.db', { fileMustExist: true })
  try {
    establishCanonicalMigrationMetadata(sqlite, 6)
  } finally {
    sqlite.close()
  }

  run([tsxCli, resolve('scripts/verify-sqlite.ts')])
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
      establishCanonicalMigrationMetadata(sqlite, 2)

      if ((sqlite.pragma('foreign_key_check') as unknown[]).length > 0) {
        throw new Error('Legacy SQLite reconciliation failed foreign-key verification')
      }
    })()
  } finally {
    sqlite.close()
  }
}

run([
  require.resolve('drizzle-kit/bin.cjs'),
  'migrate',
  '--config=drizzle.sqlite.config.ts',
])
run([tsxCli, resolve('scripts/verify-sqlite.ts')])
