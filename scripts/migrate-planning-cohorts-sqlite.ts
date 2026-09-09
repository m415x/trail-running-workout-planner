import Database from 'better-sqlite3'

import { migratePlanningCohortsSqlite } from '@/db/migrations/planning-cohorts-sqlite'

const sqlite = new Database('sqlite.db')

try {
  migratePlanningCohortsSqlite(sqlite)
} finally {
  sqlite.close()
}
