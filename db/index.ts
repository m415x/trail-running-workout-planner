import Database from 'better-sqlite3'
import { dirname, resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as coreSchema from '@/db/schema'
import * as loadStrategySchema from '@/db/load-strategy-schema'
import * as intensityStrategySchema from '@/db/intensity-strategy-schema'
import * as sessionGenerationPreferencesSchema from '@/db/session-generation-preferences-schema'
import * as competitionEntrySchema from '@/db/competition-entry-schema'
import * as readinessSchema from '@/db/readiness-schema'
import * as raceCatalogSchema from '@/db/race-catalog-schema'
import * as raceRegistrationSchema from '@/db/race-registration-schema'
import * as sessionGenerationReviewSnapshotSchema from '@/db/session-generation-review-snapshot-schema'

// The isolated SQLite scenario contract is shared with the canonical upgrade verifier.
// Never fall back to the developer DB when scenario mode is explicitly enabled.
const scenarioMode = process.env.SQLITE_SCENARIO_MODE === '1'
const nodeTestContext = process.env.NODE_TEST_CONTEXT !== undefined
const isolatedMode = scenarioMode || nodeTestContext
const sqlitePath = scenarioMode
  ? resolve(process.env.SQLITE_DATABASE_PATH ?? (() => { throw new Error('SQLITE_DATABASE_PATH is required for isolated SQLite tests and scenario verification') })())
  : nodeTestContext
    ? process.env.SQLITE_DATABASE_PATH ? resolve(process.env.SQLITE_DATABASE_PATH) : ':memory:'
    : 'sqlite.db'

// An isolated scenario must never reuse the repository's development sqlite.db.
// The server and verification CLI execute from repository root; using cwd avoids\n// import.meta.dirname being undefined in Next/Turbopack module evaluation.\n// Resolving both paths also rejects relative aliases such as ./sqlite.db.
if (isolatedMode) {
  // The SQLite verifier deliberately executes from a disposable cwd whose
  // database is also named sqlite.db. Its TSX_TSCONFIG_PATH points to the
  // repository root; compare against that root rather than the disposable cwd.
  const projectRoot = scenarioMode && process.env.TSX_TSCONFIG_PATH
    ? dirname(resolve(process.env.TSX_TSCONFIG_PATH))
    : process.cwd()
  const developmentPath = resolve(projectRoot, 'sqlite.db')
  const normalized = (path: string) => process.platform === 'win32' ? path.toLowerCase() : path
  if (normalized(sqlitePath) === normalized(developmentPath)) {
    throw new Error('SQLITE_DATABASE_PATH cannot target the development sqlite.db in scenario mode')
  }
}
const sqlite = new Database(sqlitePath, { fileMustExist: isolatedMode && sqlitePath !== ':memory:' })

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
    ...sessionGenerationReviewSnapshotSchema,
  },
})
