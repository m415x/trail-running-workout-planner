import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, renameSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { assertAccreditedScenarioSeedTarget } from '@/db/seeds/assert-disposable-target'

/**
 * Publish an acceptance fixture only after BOTH the legacy demo and H4B
 * provisioner succeed on one disposable staging database.
 * This is a local acceptance utility, never a Supabase-auth bootstrap.
 */
function main(): void {
  if (process.env.NODE_ENV === 'production' || process.env.CI === 'true') {
    throw new Error('Acceptance provisioning is forbidden in production and CI')
  }
  assertAccreditedScenarioSeedTarget()
  const target = resolve(process.env.SQLITE_DATABASE_PATH!)
  const tsconfig = resolve(process.env.TSX_TSCONFIG_PATH!)
  const projectRoot = dirname(tsconfig)
  const cli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')
  const workspace = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  const staged = join(workspace, 'sqlite.db')
  const backup = join(workspace, 'original.db')
  let originalMoved = false
  let published = false
  try {
    copyFileSync(target, staged)
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      SQLITE_SCENARIO_MODE: '1',
      SQLITE_DATABASE_PATH: staged,
      SQLITE_SEED_DISPOSABLE_ACK: '1',
      H4B_DISPOSABLE_ORCHESTRATION: '1',
      TSX_TSCONFIG_PATH: tsconfig,
    }
    const run = (script: string, args: string[] = []) => {
      const result = spawnSync(process.execPath, [cli, resolve(projectRoot, script), ...args], {
        cwd: workspace, env, encoding: 'utf8', timeout: 120000,
      })
      if (result.error || result.status !== 0) {
        throw new Error(`KAN-838 acceptance phase ${script} failed: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`)
      }
    }
    run('db/seeds/demo.ts')
    run('scripts/provision-h4b-acceptance-actors.ts', ['--apply'])
    // No mutation of the requested target before BOTH phases pass.
    renameSync(target, backup)
    originalMoved = true
    renameSync(staged, target)
    published = true
    rmSync(backup, { force: true })
    originalMoved = false
    console.log('KAN-838: disposable acceptance published after demo and H4B succeeded')
  } finally {
    if (originalMoved && !published && existsSync(backup)) renameSync(backup, target)
    rmSync(workspace, { recursive: true, force: true })
  }
}

try {
  main()
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
