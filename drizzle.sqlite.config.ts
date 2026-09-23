import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'drizzle-kit'
import config from './drizzle.config'

const configDirectory = dirname(fileURLToPath(import.meta.url))

const scenarioMode = process.env.SQLITE_SCENARIO_MODE === '1'
const scenarioDatabasePath = process.env.SQLITE_DATABASE_PATH

if (scenarioMode && !scenarioDatabasePath) {
  throw new Error('SQLITE_DATABASE_PATH is required for isolated SQLite scenario verification')
}

// Schema and migration paths belong to the repository. Scenario verification
// must provide an explicit database path; normal development retains sqlite.db.
export default defineConfig({
  ...config,
  schema: (Array.isArray(config.schema) ? config.schema : [config.schema])
    .filter((schemaPath): schemaPath is string => typeof schemaPath === 'string')
    .map(schemaPath => resolve(configDirectory, schemaPath)),
  out: resolve(configDirectory, 'drizzle/sqlite'),
  dbCredentials: { url: scenarioMode ? resolve(scenarioDatabasePath!) : 'sqlite.db' },
})
