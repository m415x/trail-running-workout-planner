import assert from 'node:assert/strict'
import test from 'node:test'

import { runCoachSandboxStatusCommand } from '../../scripts/coach-sandbox-status'

test('KAN-585 runs only local status for an explicit repository root', async () => {
  const visited: string[] = []
  const result = await runCoachSandboxStatusCommand({
    repositoryRoot: '/workspace/trail-running-workout-planner',
    checkStatus: async ({ repositoryRoot }) => {
      visited.push(repositoryRoot)
      return { available: true }
    },
  })
  assert.deepEqual(result, { available: true })
  assert.deepEqual(visited, ['/workspace/trail-running-workout-planner'])
})

test('KAN-585 rejects invalid roots without running status', async () => {
  let invoked = false
  await assert.rejects(() => runCoachSandboxStatusCommand({
    repositoryRoot: '.',
    checkStatus: async () => {
      invoked = true
      return { available: true }
    },
  }), /root|sandbox/i)
  assert.equal(invoked, false)
})

test('KAN-585 does not display diagnostics or credentials from failed local status', async () => {
  await assert.rejects(() => runCoachSandboxStatusCommand({
    repositoryRoot: '/workspace/trail-running-workout-planner',
    checkStatus: async () => {
      throw new Error('SUPABASE_DIRECT_URL=password-secret')
    },
  }), (error: unknown) => error instanceof Error
    && /sandbox|status/i.test(error.message)
    && !error.message.includes('password-secret'))
})
