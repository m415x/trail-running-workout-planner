import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
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
import { seedFull } from '@/db/seeds'


export type SqliteVerificationScenario =
  | 'empty'
  | 'full-seed'
  | 'partial-seed'
  | 'upgrade'
  | 'preservation'
  | 'drift'
  | 'rerun'

export const sqliteVerificationScenarios: SqliteVerificationScenario[] = [
  'empty',
  'full-seed',
  'partial-seed',
  'upgrade',
  'preservation',
  'drift',
  'rerun',
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
  const result = spawnSync(command, args, { cwd, env, stdio: 'pipe', encoding: 'utf8' })
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

  throw new Error(`SQLite verification scenario is not implemented yet: ${scenario}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
