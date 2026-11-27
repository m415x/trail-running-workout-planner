import assert from 'node:assert/strict'
import test from 'node:test'
import { resolve } from 'node:path'

import * as environment from '@/scripts/acceptance-dev-child-env'

type LaunchPlanInput = {
  projectRoot: string
  databasePath: string
  port?: number
  inheritedEnv: Readonly<Record<string, string | undefined>>
}
type LaunchPlan = {
  command: string
  args: string[]
  cwd: string
  env: Record<string, string | undefined>
}
type BuildLaunchPlan = (input: LaunchPlanInput) => LaunchPlan

const projectRoot = resolve(import.meta.dirname, '../..')

test('KAN-885/T3 plans a Next dev launch bound to loopback in the current checkout', () => {
  const candidate = (environment as unknown as Record<string, unknown>)
    .buildAcceptanceDevNextLaunchPlan
  assert.equal(typeof candidate, 'function', 'Next launch plan builder must exist')
  const build = candidate as BuildLaunchPlan
  const databasePath = '/canonical/disposable/acceptance.db'
  const inheritedEnv = {
    PATH: 'test-path',
    SQLITE_SEED_DISPOSABLE_ACK: '1',
    NODE_OPTIONS: '--require=untrusted.js',
    NODE_ENV: 'production',
  }
  const plan = build({ projectRoot, databasePath, port: 4173, inheritedEnv })

  assert.equal(plan.command, process.execPath)
  assert.equal(plan.cwd, projectRoot)
  assert.deepEqual(plan.args, [
    resolve(projectRoot, 'node_modules/next/dist/bin/next'),
    'dev', '--hostname', 'localhost', '--port', '4173',
  ])
  assert.equal(plan.env.SQLITE_DATABASE_PATH, databasePath)
  assert.equal(plan.env.SQLITE_SCENARIO_MODE, '1')
  assert.equal(plan.env.NODE_ENV, 'development')
  assert.equal(plan.env.SQLITE_SEED_DISPOSABLE_ACK, undefined)
  assert.equal(plan.env.NODE_OPTIONS, undefined)
  assert.equal(inheritedEnv.NODE_ENV, 'production', 'parent environment must remain unchanged')
})

test('KAN-885/T3 launch planning rejects unsafe port values without spawning Next', () => {
  const build = (environment as unknown as Record<string, unknown>)
    .buildAcceptanceDevNextLaunchPlan as BuildLaunchPlan
  for (const port of [-1, 0, 1, 65536, 3000.5, Number.NaN]) {
    assert.throws(
      () => build({ projectRoot, databasePath: '/canonical/disposable/acceptance.db', port, inheritedEnv: {} }),
      /port|invalid|range/i,
      'invalid port must reject before process creation',
    )
  }
})
