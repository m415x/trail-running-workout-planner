import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

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
