import { migrateCompetitionEntriesSqlite } from '@/db/migrations/competition-entries-sqlite'
import { migrateMacrocycleTargetRaceDateSqlite } from '@/db/migrations/macrocycle-target-race-date-sqlite'
import { migratePlanningCohortsSqlite } from '@/db/migrations/planning-cohorts-sqlite'
import { migrateRealizedTrainingTimingSqlite } from '@/db/migrations/realized-training-timing-sqlite'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'

const require = createRequire(import.meta.url)
const tsxCli = require.resolve('tsx/cli')

function run(args: string[]): void {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function classifyExistingSqlite(): 'fresh' | 'versioned' | 'legacy' {
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

    return hasMigrationMetadata ? 'versioned' : 'legacy'
  } finally {
    sqlite.close()
  }
}

const state = classifyExistingSqlite()
if (state === 'legacy') {
  const sqlite = new Database('sqlite.db', { fileMustExist: true })
  try {
    migrateRealizedTrainingTimingSqlite(sqlite)
    migratePlanningCohortsSqlite(sqlite)
    migrateCompetitionEntriesSqlite(sqlite)
    migrateMacrocycleTargetRaceDateSqlite(sqlite)

    if ((sqlite.pragma('foreign_key_check') as unknown[]).length > 0) {
      throw new Error('Legacy SQLite reconciliation failed foreign-key verification')
    }
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
