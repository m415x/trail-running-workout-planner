import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import * as runtime from '@/scripts/acceptance-dev-child-env'

type Child = EventEmitter & { pid?: number }
type Plan = { command: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv }
type SpawnOptions = { cwd?: string; env?: NodeJS.ProcessEnv; shell: false; stdio: 'ignore'; windowsHide: true }
type Run = (input: {
  plan: Plan
  signalSource: EventEmitter
  launcherPid: number
  spawnProcess: (command: string, args: string[], options: SpawnOptions) => Child
}) => Promise<number>

const plan: Plan = {
  command: process.execPath,
  args: ['-e', 'process.exit(0)'],
  cwd: process.cwd(),
  env: { NODE_ENV: 'test' },
}

test('KAN-885/T3 L6 routes signal from spawned child handle to taskkill tree exactly once', async () => {
  const candidate = (runtime as unknown as Record<string, unknown>)
    .runAcceptanceDevWindowsManagedChild
  assert.equal(typeof candidate, 'function', 'Windows managed process boundary must exist')
  const run = candidate as Run
  const signals = new EventEmitter()
  const child = new EventEmitter() as Child
  child.pid = 45620
  const killer = new EventEmitter() as Child
  const calls: Array<{ command: string; args: string[]; options: SpawnOptions }> = []

  const result = run({
    plan,
    signalSource: signals,
    launcherPid: 45619,
    spawnProcess: (command, args, options) => {
      calls.push({ command, args, options })
      return calls.length === 1 ? child : killer
    },
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].command, process.execPath)
  assert.deepEqual(calls[0].args, plan.args)
  assert.deepEqual(calls[0].options, {
    cwd: plan.cwd, env: plan.env, shell: false, stdio: 'ignore', windowsHide: true,
  })

  signals.emit('SIGINT')
  signals.emit('SIGTERM')
  assert.equal(calls.length, 2, 'one taskkill spawn only')
  assert.equal(calls[1].command, 'taskkill.exe')
  assert.deepEqual(calls[1].args, ['/PID', '45620', '/T', '/F'])
  assert.deepEqual(calls[1].options, { shell: false, stdio: 'ignore', windowsHide: true })

  killer.emit('close', 0, null)
  child.emit('close', null, 'SIGTERM')
  await assert.rejects(result, /KAN-885.*signal/i)
  assert.equal(signals.listenerCount('SIGINT'), 0)
  assert.equal(signals.listenerCount('SIGTERM'), 0)
  assert.equal(child.listenerCount('close'), 0)
  assert.equal(killer.listenerCount('close'), 0)
})

test('KAN-885/T3 L6 natural exit never launches taskkill', async () => {
  const run = (runtime as unknown as Record<string, unknown>)
    .runAcceptanceDevWindowsManagedChild as Run
  const signals = new EventEmitter()
  const child = new EventEmitter() as Child
  child.pid = 45621
  let spawnCount = 0
  const result = run({
    plan,
    signalSource: signals,
    launcherPid: 45619,
    spawnProcess: () => {
      spawnCount++
      return child
    },
  })
  child.emit('close', 7, null)
  assert.equal(await result, 7)
  signals.emit('SIGINT')
  assert.equal(spawnCount, 1, 'a completed child cannot be targeted')
  assert.equal(signals.listenerCount('SIGINT'), 0)
})
