import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as coreSchema from '@/db/schema'
import * as loadStrategySchema from '@/db/load-strategy-schema'
import * as intensityStrategySchema from '@/db/intensity-strategy-schema'
import * as sessionGenerationPreferencesSchema from '@/db/session-generation-preferences-schema'
import * as competitionEntrySchema from '@/db/competition-entry-schema'
import * as readinessSchema from '@/db/readiness-schema'
import * as raceCatalogSchema from '@/db/race-catalog-schema'
import * as raceRegistrationSchema from '@/db/race-registration-schema'

// The isolated SQLite scenario contract is shared with the canonical upgrade verifier.
// Never fall back to the developer DB when scenario mode is explicitly enabled.
const sqlitePath = process.env.SQLITE_SCENARIO_MODE === '1'
  ? process.env.SQLITE_DATABASE_PATH ?? (() => { throw new Error('SQLITE_DATABASE_PATH is required for SQLite scenario verification') })()
  : 'sqlite.db'
const sqlite = new Database(sqlitePath, { fileMustExist: process.env.SQLITE_SCENARIO_MODE === '1' })

// Instancia de Drizzle con autocompletado, tipos y relaciones de todos los módulos del esquema
export const db = drizzle(sqlite, {
  schema: {
    ...coreSchema,
    ...loadStrategySchema,
    ...intensityStrategySchema,
    ...sessionGenerationPreferencesSchema,
    ...competitionEntrySchema,
    ...readinessSchema,
    ...raceCatalogSchema,
    ...raceRegistrationSchema,
  },
})
