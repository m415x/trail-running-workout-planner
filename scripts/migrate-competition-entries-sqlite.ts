import Database from 'better-sqlite3'

import { migrateCompetitionEntriesSqlite } from '@/db/migrations/competition-entries-sqlite'

const sqlite = new Database('sqlite.db')

try {
  migrateCompetitionEntriesSqlite(sqlite)
} finally {
  sqlite.close()
}
