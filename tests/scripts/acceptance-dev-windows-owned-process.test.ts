import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { resolve } from 'node:path'
import test from 'node:test'

import * as runtime from '@/scripts/acceptance-dev-child-env'

type LaunchPlan = { command: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv }
type RunOwned = (input: {
  plan: LaunchPlan
  signalSource: EventEmitter
  terminationTimeoutMs?: number
}) => Promise<number>

const root = resolve(import.meta.dirname, '../..')
const base: LaunchPlan = {
  command: process.execPath,
  args: ['-e', 'process.exit(0)'],
  cwd: root,
  env: { NODE_ENV: 'test' },
}

async function within<T>(pending: Promise<T>): Promise<T> {
  let watchdog: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        watchdog = setTimeout(() => reject(new Error(
          'KAN-885 test watchdog: owned child did not settle',
        )), 4000)
      }),
    ])
  } finally {
    if (watchdog) clearTimeout(watchdog)
  }
}

test('KAN-885/T3 L6 production adapter spawns a real short-lived Node child without Next', async () => {
  const candidate = (runtime as unknown as Record<string, unknown>)
    .runAcceptanceDevWindowsOwnedProcess
  assert.equal(typeof candidate, 'function', 'real child-process adapter must be exported')
  const run = candidate as RunOwned
  const signals = new EventEmitter()
  assert.equal(await within(run({ plan: base, signalSource: signals })), 0)
  assert.equal(await within(run({
    plan: { ...base, args: ['-e', 'process.exit(9)'] },
    signalSource: signals,
  })), 9)
  assert.equal(signals.listenerCount('SIGINT'), 0)
  assert.equal(signals.listenerCount('SIGTERM'), 0)
})

test('KAN-885/T3 L6 production adapter reports spawn errors without an unhandled error or secrets', async () => {
  const run = (runtime as unknown as Record<string, unknown>)
    .runAcceptanceDevWindowsOwnedProcess as RunOwned
  const signals = new EventEmitter()
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: 'test',
    ACCEPTANCE_SECRET: 'dont-print-acceptance-secret',
  }
  await assert.rejects(
    () => within(run({
      plan: {
        command: resolve(root, 'missing-kan-885-executable'),
        args: [],
        cwd: root,
        env,
      },
      signalSource: signals,
    })),
    error => {
      assert.ok(error instanceof Error)
      assert.match(error.message, /KAN-885/i)
      assert.doesNotMatch(error.message, /dont-print-acceptance-secret/)
      return true
    },
  )
  assert.equal(signals.listenerCount('SIGINT'), 0)
  assert.equal(signals.listenerCount('SIGTERM'), 0)
})
