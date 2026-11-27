import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { buildAcceptanceDevCtrlcProbeRunPlan } from '@/scripts/acceptance-dev-windows-ctrlc-probe-state'
import {
  runAcceptanceDevCtrlcProbeWindowsManagedWorker,
} from '@/scripts/acceptance-dev-windows-ctrlc-probe-run'

const root = resolve(import.meta.dirname, '../..')
const nonce = 'f6f8188a8e81f031b5f87e12ad1b0c32'
const statePath = join(root, '.tmp', 'kan-885-guard-test-only.json')
const plan = buildAcceptanceDevCtrlcProbeRunPlan({
  projectRoot: root,
  statePath,
  nonce,
  inheritedEnv: { NODE_ENV: 'test', PATH: process.env.PATH, SystemRoot: process.env.SystemRoot },
})

test('KAN-885/T3 L6 accepts a canonical disposable worker plan before delegating to a managed child', async () => {
  const signals = new EventEmitter()
  const child = Object.assign(new EventEmitter(), { pid: 58302 })
  let launched = 0
  const pending = runAcceptanceDevCtrlcProbeWindowsManagedWorker({
    plan,
    signalSource: signals,
    launcherPid: 58301,
    spawnProcess: () => {
      launched += 1
      return child
    },
  })
  assert.equal(launched, 1)
  child.emit('close', 0, null)
  assert.equal(await pending, 0)
})

test('KAN-885/T3 L6 rejects forged worker launch plans before spawning or installing signal handlers', async () => {
  const attacks = [
    { ...plan, command: 'powershell.exe' },
    { ...plan, args: [...plan.args, '--unexpected'] },
    { ...plan, args: ['--import', 'tsx', join(root, 'scripts', 'acceptance-dev.ts'), ...plan.args.slice(3)] },
    { ...plan, cwd: resolve(root, '..') },
    { ...plan, env: { ...plan.env, SECRET_TOKEN: 'leak-this' } },
    { ...plan, env: { ...plan.env, SQLITE_DATABASE_PATH: 'sqlite.db' } },
    { ...plan, env: { ...plan.env, NODE_ENV: 'production' as const } },
    { ...plan, args: [...plan.args.slice(0, 4), join(root, '..', 'outside.json'), ...plan.args.slice(5)] },
  ]
  for (const forged of attacks) {
    const signals = new EventEmitter()
    let spawned = false
    await assert.rejects(
      runAcceptanceDevCtrlcProbeWindowsManagedWorker({
        plan: forged,
        signalSource: signals,
        launcherPid: 58301,
        spawnProcess: () => {
          spawned = true
          // Fail synchronously instead of returning a mock child that never
          // closes: the previous RED fixture could hang indefinitely.
          throw new Error('KAN-885: forbidden worker spawn reached')
        },
      }),
      /KAN-885/i,
    )
    assert.equal(spawned, false, 'untrusted plan must never reach OS process creation')
    assert.equal(signals.listenerCount('SIGINT'), 0)
    assert.equal(signals.listenerCount('SIGTERM'), 0)
  }
})
