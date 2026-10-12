import Database from 'better-sqlite3'
import { auditH7aPhysicalSchema } from './h7a-physical-schema'
import { inspectH7aMigrationGuard } from './h7a-metadata-drift-guard'

const path = process.env.SQLITE_SCENARIO_MODE === '1'
  ? process.env.SQLITE_DATABASE_PATH ?? (() => { throw new Error('SQLITE_DATABASE_PATH is required') })()
  : 'sqlite.db'
const db = new Database(path, { readonly: true, fileMustExist: true })
try {
  const failures = [...new Set([...auditH7aPhysicalSchema(db), ...inspectH7aMigrationGuard(db)])]
  if (failures.length) throw new Error('H7A SQLite verification failed: ' + failures.join('; '))
  console.log('H7A SQLite physical and migration verification passed')
} finally {
  db.close()
}
