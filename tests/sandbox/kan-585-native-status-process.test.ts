import assert from 'node:assert/strict'
import test from 'node:test'

import { checkLocalCoachSandboxStatusWithProcess } from '../../lib/sandbox/local-status-process'

const repositoryRoot = '/workspace/trail-running-workout-planner'
const nativeBinary = '/workspace/trail-running-workout-planner/node_modules/supabase/bin/supabase'

test('KAN-585 uses the native project CLI binary with shell disabled', async () => {
  const calls: unknown[][] = []
  const result = await checkLocalCoachSandboxStatusWithProcess({
    repositoryRoot,
    resolveBinary: (root) => {
      assert.equal(root, repositoryRoot)
      return nativeBinary
    },
    execFile: async (command, args, options) => {
      calls.push([command, args, options])
      return { exitCode: 0 }
    },
  })

  assert.deepEqual(result, { available: true })
  assert.deepEqual(calls, [[
    nativeBinary,
    ['status', '--workdir', repositoryRoot],
    {
      cwd: repositoryRoot,
      shell: false,
      timeout: 15000,
      maxBuffer: 65536,
      windowsHide: true,
    },
  ]])
})

test('KAN-585 fails closed before spawning if native binary resolution fails', async () => {
  let spawned = false
  await assert.rejects(() => checkLocalCoachSandboxStatusWithProcess({
    repositoryRoot,
    resolveBinary: () => { throw new Error('password=PRIVATE') },
    execFile: async () => { spawned = true; return { exitCode: 0 } },
  }), (error: unknown) => error instanceof Error
    && /sandbox|status/i.test(error.message)
    && !error.message.includes('PRIVATE'))
  assert.equal(spawned, false)
})
