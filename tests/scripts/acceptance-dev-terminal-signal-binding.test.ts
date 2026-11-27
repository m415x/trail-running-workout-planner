import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import test from 'node:test'

import * as runtime from '@/scripts/acceptance-dev-child-env'

type LaunchPlan = { command: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv }
type RunTerminal = (input: { plan: LaunchPlan; terminationTimeoutMs?: number }) => Promise<number>

const root = resolve(import.meta.dirname, '../..')
const plan: LaunchPlan = {
  command: process.execPath,
  args: ['-e', 'setTimeout(() => process.exit(0), 250)'],
  cwd: root,
  env: { NODE_ENV: 'test' },
}

test('KAN-885/T3 L6 terminal adapter binds actual launcher process signals only while child lives', async () => {
  const candidate = (runtime as unknown as Record<string, unknown>)
    .runAcceptanceDevWindowsTerminalProcess
  assert.equal(typeof candidate, 'function', 'terminal-facing Windows process adapter must exist')
  const run = candidate as RunTerminal

  const beforeSigint = process.listenerCount('SIGINT')
  const beforeSigterm = process.listenerCount('SIGTERM')
  const pending = run({ plan })
  try {
    assert.equal(process.listenerCount('SIGINT'), beforeSigint + 1,
      'terminal Ctrl+C must be observed on the actual launcher process')
    assert.equal(process.listenerCount('SIGTERM'), beforeSigterm + 1)
    assert.equal(await pending, 0)
  } finally {
    await pending.catch(() => {})
  }
  assert.equal(process.listenerCount('SIGINT'), beforeSigint,
    'completed run must remove its Ctrl+C handler')
  assert.equal(process.listenerCount('SIGTERM'), beforeSigterm)
})

test('KAN-885/T3 L6 terminal adapter preserves unsuccessful child status and unbinds signals', async () => {
  const run = (runtime as unknown as Record<string, unknown>)
    .runAcceptanceDevWindowsTerminalProcess as RunTerminal
  const beforeSigint = process.listenerCount('SIGINT')
  const beforeSigterm = process.listenerCount('SIGTERM')
  assert.equal(await run({
    plan: { ...plan, args: ['-e', 'process.exit(7)'] },
  }), 7)
  assert.equal(process.listenerCount('SIGINT'), beforeSigint)
  assert.equal(process.listenerCount('SIGTERM'), beforeSigterm)
})
