import Database from 'better-sqlite3'

import { migrateMacrocycleTargetRaceDateSqlite } from '@/db/migrations/macrocycle-target-race-date-sqlite'

const sqlite = new Database('sqlite.db')

try {
  migrateMacrocycleTargetRaceDateSqlite(sqlite)
} finally {
  sqlite.close()
}
