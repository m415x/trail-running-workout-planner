import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

import { runCoachSandboxStatusCli } from '../../scripts/coach-sandbox-status-cli'

test('KAN-585 exposes a repository-local, status-only pnpm command', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8')) as {
    scripts: Record<string, string>
  }
  assert.equal(pkg.scripts['db:sandbox:status'], 'tsx scripts/coach-sandbox-status-cli.ts')
})

test('KAN-585 resolves an explicit repository root and runs only status', async () => {
  const root = '/workspace/trail-running-workout-planner'
  const calls: string[] = []
  const result = await runCoachSandboxStatusCli({
    args: [],
    repositoryRoot: root,
    checkStatus: async ({ repositoryRoot }) => {
      calls.push(repositoryRoot)
      return { available: true }
    },
  })
  assert.deepEqual(result, { available: true })
  assert.deepEqual(calls, [root])
})

test('KAN-585 rejects all user-provided CLI arguments before any subprocess', async () => {
  for (const args of [['reset'], ['--linked'], ['--workdir', '/other'], ['db', 'push']]) {
    let invoked = false
    await assert.rejects(() => runCoachSandboxStatusCli({
      args,
      repositoryRoot: '/workspace/trail-running-workout-planner',
      checkStatus: async () => {
        invoked = true
        return { available: true }
      },
    }), /argument|status|sandbox/i)
    assert.equal(invoked, false)
  }
})

test('KAN-585 rejects invalid root and sanitizes unexpected diagnostic failures', async () => {
  await assert.rejects(() => runCoachSandboxStatusCli({
    args: [],
    repositoryRoot: '.',
    checkStatus: async () => { throw new Error('this should not run') },
  }), /root|sandbox/i)
  await assert.rejects(() => runCoachSandboxStatusCli({
    args: [],
    repositoryRoot: '/workspace/trail-running-workout-planner',
    checkStatus: async () => { throw new Error('password=PRIVATE') },
  }), (error: unknown) => error instanceof Error
    && /status|sandbox/i.test(error.message)
    && !error.message.includes('PRIVATE'))
})
