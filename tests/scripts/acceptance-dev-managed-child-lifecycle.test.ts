import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import * as runtime from '@/scripts/acceptance-dev-child-env'

type Plan = { command: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv }
type Child = EventEmitter & { pid?: number }
type TerminationPlan = { command: string; args: string[]; shell: false }
type StartManaged = (input: {
  plan: Plan
  signalSource: EventEmitter
  spawnChild: (plan: Plan) => Child
  terminateTree: (plan: TerminationPlan) => Promise<void>
  launcherPid: number
}) => Promise<number>

const plan: Plan = {
  command: process.execPath,
  args: ['-e', 'process.exit(0)'],
  cwd: process.cwd(),
  env: { NODE_ENV: 'test' },
}

test('KAN-885/T3 L6 integrates owned spawn handle with one Windows tree termination', async () => {
  const candidate = (runtime as unknown as Record<string, unknown>)
    .runAcceptanceDevManagedChild
  assert.equal(typeof candidate, 'function', 'managed child runner must exist')
  const run = candidate as StartManaged
  const signals = new EventEmitter()
  const child = new EventEmitter() as Child
  child.pid = 42420
  let spawned = 0
  const executed: TerminationPlan[] = []

  const result = run({
    plan,
    signalSource: signals,
    launcherPid: 42419,
    spawnChild: selected => {
      assert.equal(selected, plan)
      spawned++
      return child
    },
    terminateTree: async selected => {
      executed.push(selected)
      child.emit('close', null, 'SIGTERM')
    },
  })
  signals.emit('SIGINT')
  signals.emit('SIGTERM')
  await assert.rejects(result, /signal|terminated|interrupt/i)
  assert.equal(spawned, 1)
  assert.deepEqual(executed, [{
    command: 'taskkill.exe',
    args: ['/PID', '42420', '/T', '/F'],
    shell: false,
  }])
  assert.equal(signals.listenerCount('SIGINT'), 0)
  assert.equal(signals.listenerCount('SIGTERM'), 0)
})

test('KAN-885/T3 L6 never terminates a child after it has closed', async () => {
  const run = (runtime as unknown as Record<string, unknown>)
    .runAcceptanceDevManagedChild as StartManaged
  const signals = new EventEmitter()
  const child = new EventEmitter() as Child
  child.pid = 42421
  let terminated = 0
  const result = run({
    plan,
    signalSource: signals,
    launcherPid: 42419,
    spawnChild: () => child,
    terminateTree: async () => { terminated++ },
  })
  child.emit('close', 0, null)
  assert.equal(await result, 0)
  signals.emit('SIGINT')
  assert.equal(terminated, 0, 'late signal must not target recycled child PID')
  assert.equal(signals.listenerCount('SIGINT'), 0)
  assert.equal(child.listenerCount('close'), 0)
})
