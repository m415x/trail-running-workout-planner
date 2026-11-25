import assert from 'node:assert/strict'
import { isAbsolute, join, resolve } from 'node:path'
import test from 'node:test'

import * as probe from '@/scripts/acceptance-dev-windows-ctrlc-probe-state'

type Plan = {
  command: string
  args: string[]
  cwd: string
  env: NodeJS.ProcessEnv
}
type Build = (input: {
  projectRoot: string
  statePath: string
  nonce: string
  inheritedEnv: NodeJS.ProcessEnv
}) => Plan

const projectRoot = resolve(import.meta.dirname, '../..')
const statePath = join(projectRoot, '.tmp', 'kan-885-new-disposable-record.json')
const nonce = 'd6f8188a8e81f031b5f87e12ad1b0c32'

test('KAN-885/T3 L6 composes a shell-free Node-only disposable worker plan with explicit provenance', () => {
  const candidate = (probe as unknown as Record<string, unknown>)
    .buildAcceptanceDevCtrlcProbeRunPlan
  assert.equal(typeof candidate, 'function', 'safe disposable Ctrl+C worker launch plan must exist')
  const build = candidate as Build
  const plan = build({
    projectRoot,
    statePath,
    nonce,
    inheritedEnv: {
      NODE_ENV: 'test',
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      SECRET_TOKEN: 'never-inherit-me',
      SQLITE_DATABASE_PATH: 'never-use-a-database',
      SUPABASE_SERVICE_ROLE_KEY: 'never-use-supabase',
    },
  })

  assert.equal(plan.command, process.execPath)
  assert.equal(plan.cwd, projectRoot)
  assert.deepEqual(plan.args.slice(0, 2), ['--import', 'tsx'])
  assert.equal(plan.args[3], '--state')
  assert.equal(plan.args[4], statePath)
  assert.equal(plan.args[5], '--nonce')
  assert.equal(plan.args[6], nonce)
  assert.equal(plan.args.length, 7)
  assert.equal(isAbsolute(plan.args[2]), true)
  assert.equal(plan.args[2], join(projectRoot, 'scripts', 'acceptance-dev-windows-ctrlc-probe-worker.ts'))
  assert.equal(plan.env.NODE_ENV, 'test')
  assert.equal(plan.env.SECRET_TOKEN, undefined)
  assert.equal(plan.env.SQLITE_DATABASE_PATH, undefined)
  assert.equal(plan.env.SUPABASE_SERVICE_ROLE_KEY, undefined)
  assert.equal(Object.keys(plan.env).some(key => key.startsWith('EPT_')), false)
})

test('KAN-885/T3 L6 rejects nonabsolute paths and malformed nonce before worker creation', () => {
  const build = (probe as unknown as Record<string, unknown>)
    .buildAcceptanceDevCtrlcProbeRunPlan as Build
  const input = {
    projectRoot,
    statePath,
    nonce,
    inheritedEnv: { NODE_ENV: 'test', PATH: process.env.PATH },
  }
  for (const changes of [
    { statePath: 'relative.json' },
    { projectRoot: '.' },
    { nonce: 'not-a-nonce' },
    { nonce: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
    { statePath: projectRoot },
  ]) {
    assert.throws(() => build({ ...input, ...changes }), /KAN-885/i)
  }
})
