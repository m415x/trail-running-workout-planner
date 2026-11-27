import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { join, resolve } from 'node:path'
import test from 'node:test'

import {
  buildAcceptanceDevCtrlcProbeRunPlan,
} from '@/scripts/acceptance-dev-windows-ctrlc-probe-state'
import * as runner from '@/scripts/acceptance-dev-windows-ctrlc-probe-run'

type SpawnOptions = {
  cwd?: string
  env?: NodeJS.ProcessEnv
  shell: false
  stdio: 'ignore'
  windowsHide: true
}
type MockChild = EventEmitter & { pid: number }
type Managed = (input: {
  plan: ReturnType<typeof buildAcceptanceDevCtrlcProbeRunPlan>
  signalSource: EventEmitter
  launcherPid: number
  spawnProcess: (command: string, args: string[], options: SpawnOptions) => MockChild
}) => Promise<number>

const root = resolve(import.meta.dirname, '../..')
const plan = buildAcceptanceDevCtrlcProbeRunPlan({
  projectRoot: root,
  statePath: join(root, '.tmp', 'kan-885-owned-worker-53.json'),
  nonce: 'd6f8188a8e81f031b5f87e12ad1b0c32',
  inheritedEnv: { NODE_ENV: 'test', PATH: process.env.PATH },
})

test('KAN-885/T3 L6 Windows worker adapter launches only the validated Node plan and releases listeners on close', async () => {
  const candidate = (runner as unknown as Record<string, unknown>)
    .runAcceptanceDevCtrlcProbeWindowsManagedWorker
  assert.equal(typeof candidate, 'function', 'Windows owned worker adapter must exist')
  const run = candidate as Managed
  const signals = new EventEmitter()
  const child = Object.assign(new EventEmitter(), { pid: 47202 })
  const calls: string[] = []
  const pending = run({
    plan,
    signalSource: signals,
    launcherPid: 47201,
    spawnProcess: (command, args, options) => {
      calls.push(command)
      assert.equal(command, process.execPath)
      assert.deepEqual(args, plan.args)
      assert.equal(options.shell, false)
      assert.equal(options.env?.NODE_ENV, 'test')
      assert.equal(options.env?.SQLITE_DATABASE_PATH, undefined)
      return child
    },
  })
  assert.deepEqual(calls, [process.execPath])
  assert.equal(signals.listenerCount('SIGINT'), 1)
  child.emit('close', 0, null)
  assert.equal(await pending, 0)
  assert.equal(signals.listenerCount('SIGINT'), 0)
  assert.equal(signals.listenerCount('SIGTERM'), 0)
})

test('KAN-885/T3 L6 Windows SIGINT targets only the spawned worker PID and never claims success', async () => {
  const run = (runner as unknown as Record<string, unknown>)
    .runAcceptanceDevCtrlcProbeWindowsManagedWorker as Managed
  const signals = new EventEmitter()
  const child = Object.assign(new EventEmitter(), { pid: 47212 })
  const helper = Object.assign(new EventEmitter(), { pid: 47213 })
  const calls: { command: string; args: string[] }[] = []
  const pending = run({
    plan,
    signalSource: signals,
    launcherPid: 47211,
    spawnProcess: (command, args, options) => {
      assert.equal(options.shell, false)
      calls.push({ command, args })
      return command === 'taskkill.exe' ? helper : child
    },
  })
  assert.equal(calls.length, 1)
  signals.emit('SIGINT')
  assert.deepEqual(calls[1], {
    command: 'taskkill.exe',
    args: ['/PID', '47212', '/T', '/F'],
  })
  helper.emit('close', 0, null)
  child.emit('close', 0, null)
  await assert.rejects(pending, /KAN-885.*interrupt|KAN-885.*terminat/i)
  assert.equal(signals.listenerCount('SIGINT'), 0)
  assert.equal(signals.listenerCount('SIGTERM'), 0)
})
