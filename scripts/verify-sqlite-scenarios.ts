import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

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
import { seedFeature, seedFull } from '@/db/seeds'


export type SqliteVerificationScenario =
  | 'empty'
  | 'full-seed'
  | 'partial-seed'
  | 'upgrade'
  | 'preservation'
  | 'drift'
  | 'rerun'
  | 'partial-metadata-head'

export const sqliteVerificationScenarios: SqliteVerificationScenario[] = [
  'empty',
  'full-seed',
  'partial-seed',
  'upgrade',
  'preservation',
  'drift',
  'rerun',
  'partial-metadata-head',
]

export interface ScenarioWorkspace {
  root: string
  sqlitePath: string
}

export function createScenarioWorkspace(name: SqliteVerificationScenario): ScenarioWorkspace {
  const root = mkdtempSync(join(tmpdir(), `trail-running-sqlite-${name}-`))
  return { root, sqlitePath: join(root, 'sqlite.db') }
}

export function removeScenarioWorkspace(workspace: ScenarioWorkspace): void {
  rmSync(workspace.root, { recursive: true, force: true })
}

export function runScenarioCommand(
  cwd: string,
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
): void {
  const projectTsconfig = resolve('tsconfig.json')
  const result = spawnSync(command, args, {
    cwd,
    env: { ...env, TSX_TSCONFIG_PATH: projectTsconfig },
    stdio: 'pipe',
    encoding: 'utf8',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      [`SQLite scenario command failed: ${command} ${args.join(' ')}`, result.stdout, result.stderr]
        .filter(Boolean)
        .join('\n'),
    )
  }
}

export function runEmptyBootstrapScenario(projectRoot = process.cwd()): void {
  const workspace = createScenarioWorkspace('empty')
  try {
    const upgradeScript = resolve(projectRoot, 'scripts/upgrade-sqlite.ts')
    const verifyScript = resolve(projectRoot, 'scripts/verify-sqlite.ts')
    const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')

    // Run from the isolated workspace so the canonical upgrade targets its
    // sqlite.db rather than the developer database. No seed composition runs.
    runScenarioCommand(workspace.root, process.execPath, [tsxCli, upgradeScript])
    assertScenarioDatabaseExists(workspace)
    runScenarioCommand(workspace.root, process.execPath, [tsxCli, verifyScript])
  } finally {
    removeScenarioWorkspace(workspace)
  }
}

export async function runFullSeedScenario(projectRoot = process.cwd()): Promise<void> {
  const workspace = createScenarioWorkspace('full-seed')
  try {
    const upgradeScript = resolve(projectRoot, 'scripts/upgrade-sqlite.ts')
    const verifyScript = resolve(projectRoot, 'scripts/verify-sqlite.ts')
    const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')

    runScenarioCommand(workspace.root, process.execPath, [tsxCli, upgradeScript])
    assertScenarioDatabaseExists(workspace)

    const sqlite = new Database(workspace.sqlitePath)
    try {
      const scenarioDb = drizzle(sqlite, {
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

      const currentWeekStart = '2026-09-21'
      const shiftISODate = (value: string, days: number): string => {
        const date = new Date(`${value}T00:00:00Z`)
        date.setUTCDate(date.getUTCDate() + days)
        return date.toISOString().slice(0, 10)
      }

      await seedFull(scenarioDb, { currentWeekStart, shiftISODate })
    } finally {
      sqlite.close()
    }

    runScenarioCommand(workspace.root, process.execPath, [tsxCli, verifyScript])
  } finally {
    removeScenarioWorkspace(workspace)
  }
}

export async function runPartialSeedScenario(projectRoot = process.cwd()): Promise<void> {
  const features = ['groups', 'competitions'] as const

  for (const feature of features) {
    const workspace = createScenarioWorkspace('partial-seed')
    try {
      const upgradeScript = resolve(projectRoot, 'scripts/upgrade-sqlite.ts')
      const verifyScript = resolve(projectRoot, 'scripts/verify-sqlite.ts')
      const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')

      runScenarioCommand(workspace.root, process.execPath, [tsxCli, upgradeScript])
      assertScenarioDatabaseExists(workspace)

      const sqlite = new Database(workspace.sqlitePath)
      try {
        const scenarioDb = drizzle(sqlite, {
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
        const currentWeekStart = '2026-09-21'
        const shiftISODate = (value: string, days: number): string => {
          const date = new Date(`${value}T00:00:00Z`)
          date.setUTCDate(date.getUTCDate() + days)
          return date.toISOString().slice(0, 10)
        }

        await seedFeature(scenarioDb, feature, { currentWeekStart, shiftISODate })
      } finally {
        sqlite.close()
      }

      runScenarioCommand(workspace.root, process.execPath, [tsxCli, verifyScript])
    } finally {
      removeScenarioWorkspace(workspace)
    }
  }
}

export function createRepresentativeLegacyDatabase(workspace: ScenarioWorkspace, projectRoot = process.cwd()): void {
  const sqlite = new Database(workspace.sqlitePath)
  try {
    // 0000 represents the reviewed pre-versioned physical shape: application
    // tables exist, workout_logs still has INTEGER duration and no
    // performed_at, and no __drizzle_migrations metadata has been established.
    sqlite.exec(readFileSync(resolve(projectRoot, 'drizzle/sqlite/0000_baseline.sql'), 'utf8'))
  } finally {
    sqlite.close()
  }
}

export function runUpgradeScenario(projectRoot = process.cwd()): void {
  const workspace = createScenarioWorkspace('upgrade')
  try {
    createRepresentativeLegacyDatabase(workspace, projectRoot)

    const upgradeScript = resolve(projectRoot, 'scripts/upgrade-sqlite.ts')
    const verifyScript = resolve(projectRoot, 'scripts/verify-sqlite.ts')
    const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')

    runScenarioCommand(workspace.root, process.execPath, [tsxCli, upgradeScript])
    runScenarioCommand(workspace.root, process.execPath, [tsxCli, verifyScript])
  } finally {
    removeScenarioWorkspace(workspace)
  }
}

export function runPreservationScenario(projectRoot = process.cwd()): void {
  const workspace = createScenarioWorkspace('preservation')
  try {
    createRepresentativeLegacyDatabase(workspace, projectRoot)

    const sqlite = new Database(workspace.sqlitePath)
    try {
      const now = '2026-09-22T00:00:00.000Z'
      sqlite.exec(`
        INSERT INTO teams (id, created_at, updated_at, name)
        VALUES ('preservation-team', '${now}', '${now}', 'Preservation Team');

        INSERT INTO users (id, created_at, updated_at, role, user_name, email, first_name, last_name)
        VALUES ('preservation-user', '${now}', '${now}', 'athlete', 'preservation-user',
                'preservation@example.test', 'Preservation', 'Athlete');

        INSERT INTO athlete_profiles
          (id, created_at, updated_at, user_id, team_id, dni)
        VALUES
          ('preservation-athlete', '${now}', '${now}', 'preservation-user',
           'preservation-team', 'KAN427');

        INSERT INTO workout_logs
          (id, created_at, updated_at, athlete_id, date, status, distance_km,
           duration_min, elevation_gain, rpe, logged_at)
        VALUES
          ('preservation-log', '${now}', '${now}', 'preservation-athlete',
           '2026-09-22', 'completed', 10.5, 64, 420, 6, '${now}');
      `)
    } finally {
      sqlite.close()
    }

    const upgradeScript = resolve(projectRoot, 'scripts/upgrade-sqlite.ts')
    const verifyScript = resolve(projectRoot, 'scripts/verify-sqlite.ts')
    const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')
    runScenarioCommand(workspace.root, process.execPath, [tsxCli, upgradeScript])

    const upgraded = new Database(workspace.sqlitePath, { fileMustExist: true })
    try {
      const row = upgraded.prepare(`
        SELECT id, athlete_id, distance_km, duration_min, elevation_gain, rpe, performed_at
        FROM workout_logs
        WHERE id = ?
      `).get('preservation-log') as {
        id: string
        athlete_id: string
        distance_km: number
        duration_min: number
        elevation_gain: number
        rpe: number
        performed_at: string | null
      } | undefined

      if (
        !row ||
        row.athlete_id !== 'preservation-athlete' ||
        row.distance_km !== 10.5 ||
        row.duration_min !== 64 ||
        row.elevation_gain !== 420 ||
        row.rpe !== 6 ||
        row.performed_at !== null
      ) {
        throw new Error('Supported SQLite upgrade did not preserve the representative workout log')
      }
    } finally {
      upgraded.close()
    }

    runScenarioCommand(workspace.root, process.execPath, [tsxCli, verifyScript])
  } finally {
    removeScenarioWorkspace(workspace)
  }
}

function readNormalizedSchema(sqlitePath: string): string[] {
  const sqlite = new Database(sqlitePath, { fileMustExist: true })
  try {
    return (sqlite.prepare(`
      SELECT type, name, tbl_name, sql
      FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%'
        AND name <> '__drizzle_migrations'
        AND tbl_name <> '__drizzle_migrations'
      ORDER BY type, name
    `).all() as Array<{ type: string; name: string; tbl_name: string; sql: string | null }>)
      .map(row => JSON.stringify(row))
  } finally {
    sqlite.close()
  }
}

export function runDriftScenario(projectRoot = process.cwd()): void {
  const fresh = createScenarioWorkspace('drift')
  const upgraded = createScenarioWorkspace('drift')
  try {
    createRepresentativeLegacyDatabase(upgraded, projectRoot)

    const upgradeScript = resolve(projectRoot, 'scripts/upgrade-sqlite.ts')
    const verifyScript = resolve(projectRoot, 'scripts/verify-sqlite.ts')
    const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')

    runScenarioCommand(fresh.root, process.execPath, [tsxCli, upgradeScript])
    runScenarioCommand(upgraded.root, process.execPath, [tsxCli, upgradeScript])
    runScenarioCommand(fresh.root, process.execPath, [tsxCli, verifyScript])
    runScenarioCommand(upgraded.root, process.execPath, [tsxCli, verifyScript])

    const freshSchema = readNormalizedSchema(fresh.sqlitePath)
    const upgradedSchema = readNormalizedSchema(upgraded.sqlitePath)
    if (
      freshSchema.length !== upgradedSchema.length ||
      freshSchema.some((entry, index) => entry !== upgradedSchema[index])
    ) {
      throw new Error('Schema drift detected between fresh HEAD and upgraded legacy SQLite databases')
    }
  } finally {
    removeScenarioWorkspace(fresh)
    removeScenarioWorkspace(upgraded)
  }
}

export function runRerunScenario(projectRoot = process.cwd()): void {
  const workspace = createScenarioWorkspace('rerun')
  try {
    createRepresentativeLegacyDatabase(workspace, projectRoot)

    const upgradeScript = resolve(projectRoot, 'scripts/upgrade-sqlite.ts')
    const verifyScript = resolve(projectRoot, 'scripts/verify-sqlite.ts')
    const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')

    runScenarioCommand(workspace.root, process.execPath, [tsxCli, upgradeScript])
    runScenarioCommand(workspace.root, process.execPath, [tsxCli, verifyScript])
    const schemaAfterFirstUpgrade = readNormalizedSchema(workspace.sqlitePath)

    // A database already at canonical HEAD must remain a safe no-op target.
    runScenarioCommand(workspace.root, process.execPath, [tsxCli, upgradeScript])
    runScenarioCommand(workspace.root, process.execPath, [tsxCli, verifyScript])
    const schemaAfterSecondUpgrade = readNormalizedSchema(workspace.sqlitePath)

    if (
      schemaAfterFirstUpgrade.length !== schemaAfterSecondUpgrade.length ||
      schemaAfterFirstUpgrade.some((entry, index) => entry !== schemaAfterSecondUpgrade[index])
    ) {
      throw new Error('SQLite schema changed after rerunning the supported upgrade at HEAD')
    }
  } finally {
    removeScenarioWorkspace(workspace)
  }
}


export function runPartialMetadataHeadScenario(projectRoot = process.cwd()): void {
  const workspace = createScenarioWorkspace('partial-metadata-head')
  try {
    const upgradeScript = resolve(projectRoot, 'scripts/upgrade-sqlite.ts')
    const verifyScript = resolve(projectRoot, 'scripts/verify-sqlite.ts')
    const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')

    runScenarioCommand(workspace.root, process.execPath, [tsxCli, upgradeScript])

    const sqlite = new Database(workspace.sqlitePath, { fileMustExist: true })
    try {
      const journal = JSON.parse(readMigrationJournal()) as { entries: Array<{ when: number }> }
      const keepThrough = journal.entries[1]?.when
      if (keepThrough === undefined) throw new Error('SQLite journal must contain 0001')
      sqlite.prepare('DELETE FROM __drizzle_migrations WHERE created_at > ?').run(keepThrough)
    } finally {
      sqlite.close()
    }

    runScenarioCommand(workspace.root, process.execPath, [tsxCli, verifyScript])
    runScenarioCommand(workspace.root, process.execPath, [tsxCli, upgradeScript])
    runScenarioCommand(workspace.root, process.execPath, [tsxCli, verifyScript])

    const reconciled = new Database(workspace.sqlitePath, { fileMustExist: true })
    try {
      const journal = JSON.parse(readMigrationJournal()) as { entries: Array<{ when: number }> }
      const metadataCount = (reconciled.prepare('SELECT COUNT(*) AS count FROM __drizzle_migrations').get() as { count: number }).count
      if (metadataCount !== journal.entries.length) {
        throw new Error('Verified HEAD schema did not reconcile complete canonical migration metadata')
      }
    } finally {
      reconciled.close()
    }
  } finally {
    removeScenarioWorkspace(workspace)
  }
}

export function assertScenarioDatabaseExists(workspace: ScenarioWorkspace): void {
  if (!existsSync(workspace.sqlitePath)) {
    throw new Error(`SQLite scenario did not create ${workspace.sqlitePath}`)
  }
}

export function readMigrationJournal(): string {
  return readFileSync(resolve('drizzle/sqlite/meta/_journal.json'), 'utf8')
}

/**
 * KAN-427 scenario harness.
 *
 * The individual scenario executors are intentionally added incrementally:
 * empty bootstrap first, then seedFull/seedFeature, representative upgrade,
 * preservation, fresh-vs-upgraded drift and safe rerun/idempotence.
 */
export function describeSqliteVerificationCoverage(): string {
  return [
    'empty bootstrap without seed',
    'seedFull full-seed',
    'seedFeature partial-seed',
    'representative upgrade to HEAD',
    'existing-data preservation',
    'fresh-vs-upgraded drift comparison',
    'safe rerun idempotence',
  ].join('; ')
}


async function main(): Promise<void> {
  const scenario = process.argv[2] as SqliteVerificationScenario | undefined

  if (!scenario) {
    throw new Error(
      `SQLite verification scenario is required: ${sqliteVerificationScenarios.join(', ')}`,
    )
  }

  if (!sqliteVerificationScenarios.includes(scenario)) {
    throw new Error(`Unknown SQLite verification scenario: ${scenario}`)
  }

  if (scenario === 'empty') {
    runEmptyBootstrapScenario()
    return
  }

  if (scenario === 'full-seed') {
    await runFullSeedScenario()
    return
  }

  if (scenario === 'partial-seed') {
    await runPartialSeedScenario()
    return
  }

  if (scenario === 'upgrade') {
    runUpgradeScenario()
    return
  }

  if (scenario === 'preservation') {
    runPreservationScenario()
    return
  }

  if (scenario === 'drift') {
    runDriftScenario()
    return
  }

  if (scenario === 'rerun') {
    runRerunScenario()
    return
  }

  if (scenario === 'partial-metadata-head') {
    runPartialMetadataHeadScenario()
    return
  }

  throw new Error(`SQLite verification scenario is not implemented yet: ${scenario}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
