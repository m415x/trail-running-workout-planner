import assert from 'node:assert/strict'
import test from 'node:test'
import { resolve } from 'node:path'

test('typecheck gate runs Next type generation before TypeScript', async () => {
  const { typecheckSteps } = await import('../scripts/typecheck-runner')

  assert.deepEqual(typecheckSteps(), [
    { command: 'next', args: ['typegen'] },
    { command: 'tsc', args: ['--noEmit'] },
  ])
})

test('typecheck gate stops after the first failed preparation step', async () => {
  const { runTypecheckSteps } = await import('../scripts/typecheck-runner')
  const calls: string[] = []

  const exitCode = runTypecheckSteps(
    [
      { command: 'next', args: ['typegen'] },
      { command: 'tsc', args: ['--noEmit'] },
    ],
    (command) => {
      calls.push(command)
      return { status: 1, signal: null, error: undefined }
    },
  )

  assert.equal(exitCode, 1)
  assert.deepEqual(calls, ['next'])
})

test('focused GREEN TDD routes typecheck through the canonical package gate', async () => {
  const { tddTypecheckCommand } = await import('../scripts/tdd')

  assert.deepEqual(tddTypecheckCommand(), {
    command: process.execPath,
    args: [resolve('scripts/typecheck-runner.ts')],
  })
})
