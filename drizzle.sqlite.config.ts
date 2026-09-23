import { resolve } from 'node:path'
import { defineConfig } from 'drizzle-kit'
import config from './drizzle.config'

const scenarioMode = process.env.SQLITE_SCENARIO_MODE === '1'
const scenarioDatabasePath = process.env.SQLITE_DATABASE_PATH

if (scenarioMode && !scenarioDatabasePath) {
  throw new Error('SQLITE_DATABASE_PATH is required for isolated SQLite scenario verification')
}

// Schema and migration paths belong to the repository. Scenario verification
// must provide an explicit database path; normal development retains sqlite.db.
export default defineConfig({
  ...config,
  schema: config.schema,
  out: config.out,
  dbCredentials: { url: scenarioMode ? resolve(scenarioDatabasePath!) : 'sqlite.db' },
})
