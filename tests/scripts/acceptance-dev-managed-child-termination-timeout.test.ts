import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import * as runtime from '@/scripts/acceptance-dev-child-env'

type Child = EventEmitter & { pid?: number }
type Plan = { command: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv }
type TerminationPlan = { command: string; args: string[]; shell: false }
type ManagedInput = {
  plan: Plan
  signalSource: EventEmitter
  spawnChild: (plan: Plan) => Child
  terminateTree: (plan: TerminationPlan) => Promise<void>
  launcherPid: number
  terminationTimeoutMs?: number
}
type RunManaged = (input: ManagedInput) => Promise<number>

const plan: Plan = {
  command: process.execPath,
  args: ['-e', 'process.exit(0)'],
  cwd: process.cwd(),
  env: { NODE_ENV: 'test' },
}

test('KAN-885/T3 L6 times out when tree termination returns but child never closes', async () => {
  const run = (runtime as unknown as Record<string, unknown>)
    .runAcceptanceDevManagedChild as RunManaged
  const signals = new EventEmitter()
  const child = new EventEmitter() as Child
  child.pid = 42500
  let terminationCount = 0
  const result = run({
    plan,
    signalSource: signals,
    spawnChild: () => child,
    terminateTree: async () => { terminationCount++ },
    launcherPid: 42419,
    terminationTimeoutMs: 25,
  })

  let watchdog: ReturnType<typeof setTimeout> | undefined
  try {
    signals.emit('SIGINT')
    await assert.rejects(
      Promise.race([
        result,
        new Promise<never>((_, reject) => {
          watchdog = setTimeout(() => reject(new Error(
            'test watchdog: managed child never settled after termination timeout',
          )), 400)
        }),
      ]),
      /KAN-885:.*(?:timed out|timeout|child.*close)/i,
    )
    assert.equal(terminationCount, 1)
    assert.equal(signals.listenerCount('SIGINT'), 0)
    assert.equal(signals.listenerCount('SIGTERM'), 0)
    assert.equal(child.listenerCount('close'), 0)
  } finally {
    if (watchdog) clearTimeout(watchdog)
    child.emit('close', null, 'SIGTERM')
  }
})

test('KAN-885/T3 L6 interrupted close before timeout remains a failure', async () => {
  const run = (runtime as unknown as Record<string, unknown>)
    .runAcceptanceDevManagedChild as RunManaged
  const signals = new EventEmitter()
  const child = new EventEmitter() as Child
  child.pid = 42501
  const result = run({
    plan,
    signalSource: signals,
    spawnChild: () => child,
    terminateTree: async () => { child.emit('close', 0, null) },
    launcherPid: 42419,
    terminationTimeoutMs: 100,
  })
  signals.emit('SIGTERM')
  await assert.rejects(result, /KAN-885: managed child terminated after interruption signal/)
  assert.equal(signals.listenerCount('SIGINT'), 0)
  assert.equal(child.listenerCount('close'), 0)
})
