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
    env: { ...env, TSX_TSCONFIG_PATH: projectTsconfig, SQLITE_SCENARIO_MODE: '1', SQLITE_DATABASE_PATH: join(cwd, 'sqlite.db') },
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

/**
 * Compare SQLite DDL by tokens rather than sqlite_master formatting.
 * Quoted identifiers and string literals remain intact, including whitespace
 * inside string defaults; column definitions and constraints are not discarded.
 */
export function normalizeSqliteSchemaSql(sql: string | null): string | null {
  if (sql === null) return null
  const tokens = sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]+\]|[(),]|[^\s(),]+/g) ?? []
  const quoteIdentifier = (value: string) => '`' + value.replaceAll('`', '``') + '`'
  const canonical = tokens.map(token => {
    if (token.startsWith('"') && token.endsWith('"')) {
      return quoteIdentifier(token.slice(1, -1).replaceAll('""', '"'))
    }
    if (token.startsWith('[') && token.endsWith(']')) {
      return quoteIdentifier(token.slice(1, -1))
    }
    return token
  })

  // ALTER TABLE ADD COLUMN appends columns physically. Compare complete column
  // and table-constraint declarations, but not their positional order.
  if (canonical[0]?.toUpperCase() === 'CREATE' && canonical[1]?.toUpperCase() === 'TABLE') {
    const opening = canonical.indexOf('(')
    if (opening !== -1) {
      const declarations: string[][] = []
      let current: string[] = []
      let depth = 0
      let closing = -1
      for (let i = opening + 1; i < canonical.length; i++) {
        const token = canonical[i]
        if (token === ')' && depth === 0) {
          if (current.length > 0) declarations.push(current)
          closing = i
          break
        }
        if (token === ',' && depth === 0) {
          declarations.push(current)
          current = []
          continue
        }
        if (token === '(') depth++
        if (token === ')') depth--
        current.push(token)
      }
      if (closing !== -1) {
        return [
          ...canonical.slice(0, opening + 1),
          ...declarations.map(declaration => declaration.join(' ')).sort(),
          ...canonical.slice(closing),
        ].join(' ')
      }
    }
  }

  return canonical.join(' ')
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
      .map(row => {
        // SQLite appends columns and can rewrite inline foreign keys on ALTER.
        // Compare the affected table by its actual columns and foreign keys.
        if (row.type === 'table' && row.name === 'field_performance_tests') {
          const columns = (sqlite.pragma('table_xinfo(field_performance_tests)') as Array<{
            name: string; type: string; notnull: number; dflt_value: string | null; pk: number; hidden: number
          }>).map(({ name, type, notnull, dflt_value, pk, hidden }) =>
            ({ name, type: type.toUpperCase(), notnull, dflt_value, pk, hidden }),
          ).sort((a, b) => a.name.localeCompare(b.name))
          const foreignKeys = (sqlite.pragma('foreign_key_list(field_performance_tests)') as Array<{
            table: string; from: string; to: string; on_update: string; on_delete: string; match: string; seq: number
          }>).map(({ table, from, to, on_update, on_delete, match, seq }) =>
            ({ table, from, to, on_update, on_delete, match, seq }),
          ).sort((a, b) => a.from.localeCompare(b.from) || a.seq - b.seq)
          return JSON.stringify({ type: row.type, name: row.name, tbl_name: row.tbl_name, columns, foreignKeys })
        }
        const sql = row.type === 'trigger'
          ? row.sql?.replace(/^CREATE\\s+TRIGGER\\s+IF\\s+NOT\\s+EXISTS\\s+/i, 'CREATE TRIGGER ')
          : row.sql
        return JSON.stringify({ ...row, sql: normalizeSqliteSchemaSql(sql ?? null) })
      })
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
    // Compare keyed, fully normalized schema entries. SQLite can list objects
    // in a different order even when their structure is identical.
    const schemaByObject = (entries: string[]) => new Map(entries.map(entry => {
      const parsed = JSON.parse(entry) as { type: string; name: string }
      return [`${parsed.type}:${parsed.name}`, entry] as const
    }))
    const freshEntries = schemaByObject(freshSchema)
    const upgradedEntries = schemaByObject(upgradedSchema)
    const differences = [...new Set([...freshEntries.keys(), ...upgradedEntries.keys()])]
      .filter(key => freshEntries.get(key) !== upgradedEntries.get(key))
    if (differences.length > 0) {
      const first = differences[0]
      const freshEntry = freshEntries.get(first)
      const upgradedEntry = upgradedEntries.get(first)
      const firstSql = (entry: string | undefined) => entry
        ? (JSON.parse(entry) as { sql?: string | null }).sql ?? entry
        : '<missing>'
      const freshSql = firstSql(freshEntry)
      const upgradedSql = firstSql(upgradedEntry)
      const mismatchAt = [...freshSql].findIndex((character, index) => character !== upgradedSql[index])
      const offset = mismatchAt >= 0 ? mismatchAt : Math.min(freshSql.length, upgradedSql.length)
      const excerpt = (sql: string) => sql.slice(Math.max(0, offset - 70), offset + 120)
      throw new Error([
        `Schema drift detected: ${differences.length} differing objects`,
        `Objects: ${differences.slice(0, 12).join(', ')}${differences.length > 12 ? ', …' : ''}`,
        `First mismatch: ${first} at character ${offset}`,
        `fresh: ${excerpt(freshSql)}`,
        `upgraded: ${excerpt(upgradedSql)}`,
      ].join('\\n'))
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
