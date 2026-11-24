import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import test from 'node:test'

const projectRoot = resolve(import.meta.dirname, '../..')

type ChildPlan = {
  command: string
  args: string[]
  cwd: string
  env: NodeJS.ProcessEnv
}
type RunChild = (plan: ChildPlan) => Promise<number>

test('KAN-885/T3 L12 propagates child exit status without invoking Next', async () => {
  const { existsSync } = await import('node:fs')
  const modulePath = resolve(projectRoot, 'scripts/acceptance-dev-process.ts')
  assert.equal(existsSync(modulePath), true, 'controlled child process runner must exist')
  const runtime = await import('../../scripts/acceptance-dev-process')
  const candidate = (runtime as unknown as Record<string, unknown>).runAcceptanceDevChild
  assert.equal(typeof candidate, 'function', 'child exit status runner must be exported')
  const run = candidate as RunChild

  const env: NodeJS.ProcessEnv = { NODE_ENV: 'test' }
  const plan: ChildPlan = {
    command: process.execPath,
    args: ['-e', 'process.exit(7)'],
    cwd: projectRoot,
    env,
  }
  assert.equal(await run(plan), 7, 'nonzero exit must not be reported as successful')
  assert.equal(await run({ ...plan, args: ['-e', 'process.exit(0)'] }), 0)
  assert.equal(env.NODE_ENV, 'test', 'runner must not mutate provided environment')
})

test('KAN-885/T3 L12 reports spawn failure without exposing child env', async () => {
  const { existsSync } = await import('node:fs')
  const modulePath = resolve(projectRoot, 'scripts/acceptance-dev-process.ts')
  assert.equal(existsSync(modulePath), true, 'controlled child process runner must exist')
  const { runAcceptanceDevChild } = await import('../../scripts/acceptance-dev-process')
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: 'test',
    ACCEPTANCE_TEST_SECRET: 'do-not-leak-this-value',
  }
  await assert.rejects(
    () => runAcceptanceDevChild({
      command: resolve(projectRoot, 'missing-acceptance-dev-executable'),
      args: [],
      cwd: projectRoot,
      env,
    }),
    error => {
      assert.ok(error instanceof Error)
      assert.match(error.message, /KAN-885|spawn|start|executable/i)
      assert.doesNotMatch(error.message, /do-not-leak-this-value/)
      return true
    },
  )
})
