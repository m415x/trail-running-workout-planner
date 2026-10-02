import assert from 'node:assert/strict'
import test from 'node:test'
import { checkLocalCoachSandboxStatusWithProcess } from '../../lib/sandbox/local-status-process'

const root = '/workspace/trail-running-workout-planner'

test('KAN-585 launches status via execFile without shell, with bounded resources', async () => {
  const calls: unknown[][] = []
  const result = await checkLocalCoachSandboxStatusWithProcess({
    repositoryRoot: root,
    execFile: async (command, args, options) => {
      calls.push([command, args, options])
      return { exitCode: 0 }
    },
  })

  assert.deepEqual(result, { available: true })
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.[0], 'supabase')
  assert.deepEqual(calls[0]?.[1], ['status', '--workdir', root])
  assert.deepEqual(calls[0]?.[2], {
    cwd: root,
    shell: false,
    timeout: 15000,
    maxBuffer: 65536,
    windowsHide: true,
  })
})

test('KAN-585 never launches for an invalid repository root', async () => {
  let launched = false
  await assert.rejects(() => checkLocalCoachSandboxStatusWithProcess({
    repositoryRoot: '.',
    execFile: async () => { launched = true; return { exitCode: 0 } },
  }), /root|sandbox/i)
  assert.equal(launched, false)
})

test('KAN-585 suppresses failure output and does not retry process execution', async () => {
  let calls = 0
  await assert.rejects(() => checkLocalCoachSandboxStatusWithProcess({
    repositoryRoot: root,
    execFile: async () => {
      calls++
      throw new Error('postgresql://postgres:secret@127.0.0.1:54322/postgres')
    },
  }), (error: unknown) => error instanceof Error
    && /status|sandbox/i.test(error.message)
    && !error.message.includes('secret'))
  assert.equal(calls, 1)
})
