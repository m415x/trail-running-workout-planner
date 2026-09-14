import Database from 'better-sqlite3'
import { migrateRealizedTrainingTimingSqlite } from '@/db/migrations/realized-training-timing-sqlite'

const sqlite = new Database('sqlite.db', { fileMustExist: true })
try {
  migrateRealizedTrainingTimingSqlite(sqlite)
  console.log('SQLite workout_logs timing migration verified')
} finally {
  sqlite.close()
}
