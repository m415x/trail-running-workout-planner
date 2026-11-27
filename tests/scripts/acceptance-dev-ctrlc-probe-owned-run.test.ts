import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { join, resolve } from 'node:path'
import test from 'node:test'

import * as runner from '@/scripts/acceptance-dev-windows-ctrlc-probe-run'

type Plan = {
  command: string
  args: string[]
  cwd: string
  env: NodeJS.ProcessEnv
}
type Execute = (input: {
  projectRoot: string
  statePath: string
  nonce: string
  inheritedEnv: NodeJS.ProcessEnv
  signalSource: EventEmitter
  runOwnedWorker: (plan: Plan, signalSource: EventEmitter) => Promise<number>
}) => Promise<number>

const projectRoot = resolve(import.meta.dirname, '../..')
const statePath = join(projectRoot, '.tmp', 'kan-885-owned-worker-state.json')
const nonce = 'f6f8188a8e81f031b5f87e12ad1b0c32'
const env: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PATH: process.env.PATH,
  SystemRoot: process.env.SystemRoot,
  SECRET_TOKEN: 'must-not-cross-worker-boundary',
  SQLITE_DATABASE_PATH: 'must-not-cross-worker-boundary',
}

test('KAN-885/T3 L6 positive run boundary supplies only an allowlisted worker plan to the owned lifecycle', async () => {
  const candidate = (runner as unknown as Record<string, unknown>).runAcceptanceDevCtrlcProbeOwnedWorker
  assert.equal(typeof candidate, 'function', 'owned disposable run boundary must exist')
  const run = candidate as Execute
  const signals = new EventEmitter()
  let calls = 0
  const result = await run({
    projectRoot,
    statePath,
    nonce,
    inheritedEnv: env,
    signalSource: signals,
    runOwnedWorker: async (plan, actualSignals) => {
      calls += 1
      assert.equal(actualSignals, signals)
      assert.equal(plan.command, process.execPath)
      assert.equal(plan.cwd, projectRoot)
      assert.deepEqual(plan.args, [
        '--import', 'tsx',
        join(projectRoot, 'scripts', 'acceptance-dev-windows-ctrlc-probe-worker.ts'),
        '--state', statePath, '--nonce', nonce,
      ])
      assert.equal(plan.env.NODE_ENV, 'test')
      assert.equal(plan.env.SECRET_TOKEN, undefined)
      assert.equal(plan.env.SQLITE_DATABASE_PATH, undefined)
      assert.equal(Object.keys(plan.env).some(key => key.startsWith('EPT_')), false)
      return 0
    },
  })
  assert.equal(calls, 1)
  assert.equal(result, 0)
})

test('KAN-885/T3 L6 rejects invalid run configuration before invoking any worker', async () => {
  const run = (runner as unknown as Record<string, unknown>)
    .runAcceptanceDevCtrlcProbeOwnedWorker as Execute
  let calls = 0
  const input = {
    projectRoot,
    statePath,
    nonce,
    inheritedEnv: env,
    signalSource: new EventEmitter(),
    runOwnedWorker: async () => { calls += 1; return 0 },
  }
  await assert.rejects(run({ ...input, nonce: 'invalid' }), /KAN-885/i)
  await assert.rejects(run({ ...input, statePath: 'relative-state.json' }), /KAN-885/i)
  assert.equal(calls, 0)
})

test('KAN-885/T3 L6 propagates owned-run interruption as failure without claiming verification success', async () => {
  const run = (runner as unknown as Record<string, unknown>)
    .runAcceptanceDevCtrlcProbeOwnedWorker as Execute
  await assert.rejects(run({
    projectRoot,
    statePath,
    nonce,
    inheritedEnv: env,
    signalSource: new EventEmitter(),
    runOwnedWorker: async () => {
      throw new Error('KAN-885: owned worker interrupted')
    },
  }), /KAN-885.*interrupt/i)
})
