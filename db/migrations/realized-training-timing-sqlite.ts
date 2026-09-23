import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type Database from 'better-sqlite3'

/** Apply the reviewed Drizzle table rebuild to an existing push-managed database.
 * Foreign keys must be disabled before BEGIN, or DROP would cascade evidence.
 * The transaction verifies integrity before committing and restores connection policy.
 */
export function migrateRealizedTrainingTimingSqlite(sqlite: Database.Database): void {
  const columns = sqlite.prepare('PRAGMA table_info(workout_logs)').all() as { name: string; type: string }[]
  const performed = columns.find(column => column.name === 'performed_at')
  const duration = columns.find(column => column.name === 'duration_min')
  if (performed && duration?.type.toUpperCase() === 'REAL') return
  if (performed || duration?.type.toUpperCase() !== 'INTEGER') {
    throw new Error('Unexpected workout_logs schema; inspect it before migrating')
  }
  if (sqlite.inTransaction) throw new Error('Migration must start outside a transaction')
  const foreignKeys = sqlite.pragma('foreign_keys', { simple: true }) as number
  const migration = readFileSync(resolve(import.meta.dirname, '../../drizzle/sqlite/0001_realized_training_timing.sql'), 'utf8')
    .replace(/PRAGMA foreign_keys=(OFF|ON);/g, '')
  sqlite.pragma('foreign_keys = OFF')
  try {
    sqlite.transaction(() => {
      sqlite.exec(migration)
      if ((sqlite.pragma('foreign_key_check') as unknown[]).length) throw new Error('Foreign key integrity check failed')
    })()
  } finally {
    sqlite.pragma(`foreign_keys = ${foreignKeys}`)
  }
}
