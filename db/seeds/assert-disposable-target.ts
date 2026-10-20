import { realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, resolve, sep } from 'node:path'

// KAN-834 S2: scenario seeding requires independent disposable-target accreditation.
// This does not change the historical db:seed:base composition (KAN-835/S3).
export function assertAccreditedScenarioSeedTarget(): void {
  if (process.env.SQLITE_SCENARIO_MODE !== '1') {
    throw new Error('KAN-834: seed destination is not explicitly accredited as disposable')
  }
  const path = process.env.SQLITE_DATABASE_PATH
  if (!path || process.env.SQLITE_SEED_DISPOSABLE_ACK !== '1') {
    throw new Error('KAN-834: isolated seed target is not explicitly accredited as disposable')
  }
  const actual = realpathSync(path)
  const parent = realpathSync(dirname(actual))
  const tempRoot = realpathSync(tmpdir())
  // Scenario runner deliberately executes with cwd at the disposable workspace.
  // Resolve the canonical developer DB from the project tsconfig, not process.cwd().
  const projectTsconfig = process.env.TSX_TSCONFIG_PATH
  if (!projectTsconfig) throw new Error('KAN-834: project tsconfig is required for isolated seed accreditation')
  const developerDb = resolve(dirname(projectTsconfig), 'sqlite.db')
  const norm = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value
  if (
    norm(resolve(actual)) === norm(developerDb) ||
    !norm(resolve(parent)).startsWith(norm(resolve(tempRoot)) + (process.platform === 'win32' ? '\\' : sep)) ||
    !basename(parent).startsWith('trail-running-sqlite-base-seed-')
  ) {
    throw new Error('KAN-834: seed destination lacks a recognized disposable scenario workspace')
  }
}

