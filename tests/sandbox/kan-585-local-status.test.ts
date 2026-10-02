import assert from 'node:assert/strict'
import test from 'node:test'

import { checkLocalCoachSandboxStatus } from '../../lib/sandbox/local-status'

const repositoryRoot = '/workspace/trail-running-workout-planner'

test('KAN-585 executes only the planned read-only local status command', async () => {
  const calls: unknown[][] = []
  const result = await checkLocalCoachSandboxStatus({
    repositoryRoot,
    run: async (command, args, options) => {
      calls.push([command, args, options])
      return { exitCode: 0 }
    },
  })
  assert.deepEqual(result, { available: true })
  assert.deepEqual(calls, [[
    'supabase',
    ['status', '--workdir', repositoryRoot],
    { cwd: repositoryRoot },
  ]])
})

test('KAN-585 fails closed on CLI failure without exposing command output', async () => {
  await assert.rejects(() => checkLocalCoachSandboxStatus({
    repositoryRoot,
    run: async () => ({ exitCode: 1, stderr: 'password=NOT_FOR_LOGS' }),
  }), (error: unknown) => error instanceof Error
    && /sandbox|status|local/i.test(error.message)
    && !error.message.includes('NOT_FOR_LOGS'))
})

test('KAN-585 rejects an invalid root before launching CLI', async () => {
  let invoked = false
  await assert.rejects(() => checkLocalCoachSandboxStatus({
    repositoryRoot: '.',
    run: async () => { invoked = true; return { exitCode: 0 } },
  }), /root|path|sandbox/i)
  assert.equal(invoked, false)
})

test('KAN-585 sanitizes process-launch errors and never retries', async () => {
  let calls = 0
  await assert.rejects(() => checkLocalCoachSandboxStatus({
    repositoryRoot,
    run: async () => { calls++; throw new Error('token=SECRET_SHOULD_NOT_LEAK') },
  }), (error: unknown) => error instanceof Error
    && /sandbox|status|local/i.test(error.message)
    && !error.message.includes('SECRET_SHOULD_NOT_LEAK'))
  assert.equal(calls, 1)
})
