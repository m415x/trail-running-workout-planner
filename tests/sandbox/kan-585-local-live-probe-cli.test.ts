import assert from 'node:assert/strict'
import test from 'node:test'

import { runCoachSandboxReadOnlyProbeCli } from '../../scripts/coach-sandbox-probe-cli'

test('KAN-585 explicit local probe CLI invokes one read-only verification and reports only booleans', async () => {
  let called = 0
  let actualRoot = ''
  const result = await runCoachSandboxReadOnlyProbeCli({
    args: [],
    repositoryRoot: process.cwd(),
    probe: async repositoryRoot => {
      called += 1
      actualRoot = repositoryRoot
      return { verified: true, freshJournal: true }
    },
  })
  assert.equal(called, 1)
  assert.equal(actualRoot, process.cwd())
  assert.deepEqual(result, { verified: true, freshJournal: true })
})

test('KAN-585 read-only probe CLI rejects flags before reading pins or opening connections', async () => {
  for (const args of [
    ['--migrate'], ['--seed'], ['--reset'], ['--url', 'postgresql://postgres@remote.example.org:5432/postgres'],
  ]) {
    let invoked = false
    await assert.rejects(() => runCoachSandboxReadOnlyProbeCli({
      args,
      repositoryRoot: process.cwd(),
      probe: async () => {
        invoked = true
        return { verified: true, freshJournal: true }
      },
    }), /argument|probe|sandbox|local/i)
    assert.equal(invoked, false)
  }
})

test('KAN-585 probe CLI sanitizes underlying failure details and never invents GREEN', async () => {
  let invoked = false
  await assert.rejects(
    () => runCoachSandboxReadOnlyProbeCli({
      args: [],
      repositoryRoot: process.cwd(),
      probe: async () => {
        invoked = true
        throw new Error('postgresql://postgres:PRIVATE@127.0.0.1:54322/postgres')
      },
    }),
    error => error instanceof Error && /probe|failed|verification/i.test(error.message)
      && !error.message.includes('PRIVATE'),
  )
  assert.equal(invoked, true)
})
