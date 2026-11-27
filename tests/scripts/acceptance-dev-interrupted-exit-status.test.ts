import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import * as runtime from '@/scripts/acceptance-dev-child-env'

type Child = EventEmitter & { pid?: number }
type Plan = { command: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv }
type TerminationPlan = { command: string; args: string[]; shell: false }
type Managed = (input: {
  plan: Plan
  signalSource: EventEmitter
  spawnChild: (plan: Plan) => Child
  terminateTree: (plan: TerminationPlan) => Promise<void>
  launcherPid: number
  terminationTimeoutMs?: number
}) => Promise<number>

const plan: Plan = {
  command: process.execPath,
  args: ['-e', 'process.exit(0)'],
  cwd: process.cwd(),
  env: { NODE_ENV: 'test' },
}

test('KAN-885/T3 L6 interrupted child must not report successful exit zero', async () => {
  const run = (runtime as unknown as Record<string, unknown>)
    .runAcceptanceDevManagedChild as Managed
  assert.equal(typeof run, 'function')
  const signals = new EventEmitter()
  const child = new EventEmitter() as Child
  child.pid = 46700
  let requested = 0
  const result = run({
    plan,
    signalSource: signals,
    spawnChild: () => child,
    launcherPid: 46699,
    terminateTree: async () => { requested++ },
    terminationTimeoutMs: 100,
  })
  signals.emit('SIGINT')
  child.emit('close', 0, null)
  await assert.rejects(result, /KAN-885.*(?:interrupt|cancel|signal|terminat)/i,
    'a Ctrl+C request cannot be reported as a successful launch')
  assert.equal(requested, 1)
  assert.equal(signals.listenerCount('SIGINT'), 0)
  assert.equal(signals.listenerCount('SIGTERM'), 0)
})

test('KAN-885/T3 L6 termination error remains a failure if child closes zero', async () => {
  const run = (runtime as unknown as Record<string, unknown>)
    .runAcceptanceDevManagedChild as Managed
  const signals = new EventEmitter()
  const child = new EventEmitter() as Child
  child.pid = 46701
  const result = run({
    plan,
    signalSource: signals,
    spawnChild: () => child,
    launcherPid: 46699,
    terminateTree: () => Promise.reject(new Error('sensitive-path-from-taskkill')),
    terminationTimeoutMs: 100,
  })
  signals.emit('SIGTERM')
  await Promise.resolve()
  child.emit('close', 0, null)
  await assert.rejects(result, error => {
    assert.ok(error instanceof Error)
    assert.match(error.message, /KAN-885.*(?:termination|failed|signal)/i)
    assert.doesNotMatch(error.message, /sensitive-path-from-taskkill/)
    return true
  })
  assert.equal(signals.listenerCount('SIGINT'), 0)
  assert.equal(child.listenerCount('close'), 0)
})
