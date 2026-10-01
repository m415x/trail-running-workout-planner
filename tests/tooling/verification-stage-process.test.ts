import assert from 'node:assert/strict'
import { test } from 'node:test'

import { executeVerifyStage } from '@/scripts/verify-cli'

test('KAN-568 launches pnpm through Node without a shell and buffers output by default', () => {
  const calls: Array<{ command: string; args: string[]; options: Record<string, unknown> }> = []
  const result = executeVerifyStage(
    { label: 'Tests', command: 'test' },
    false,
    {
      npmExecPath: 'C:/tools/pnpm/bin/pnpm.cjs',
      nodeExecPath: 'C:/Program Files/nodejs/node.exe',
      platform: 'win32',
      spawn: (command, args, options) => {
        calls.push({ command, args, options })
        return { status: 1, stdout: 'not ok 2 - failing suite', stderr: 'error: assertion failed', signal: null }
      },
    },
  )

  assert.equal(result.exitCode, 1)
  assert.match(result.output, /not ok 2 - failing suite/)
  assert.match(result.output, /error: assertion failed/)
  assert.deepEqual(calls.map(({ command, args }) => ({ command, args })), [{
    command: 'C:/Program Files/nodejs/node.exe',
    args: ['C:/tools/pnpm/bin/pnpm.cjs', 'run', 'test'],
  }])
  assert.equal(calls[0].options.shell, false)
  assert.deepEqual(calls[0].options.stdio, ['ignore', 'pipe', 'pipe'])
})

test('KAN-568 verbose streams process output and process errors remain failed', () => {
  const calls: Array<Record<string, unknown>> = []
  const result = executeVerifyStage(
    { label: 'Build', command: 'build' },
    true,
    {
      npmExecPath: '/usr/local/lib/node_modules/pnpm/bin/pnpm.cjs',
      nodeExecPath: '/usr/bin/node',
      platform: 'linux',
      spawn: (_command, _args, options) => {
        calls.push(options)
        return { status: null, stdout: null, stderr: null, signal: null, error: new Error('spawn unavailable') }
      },
    },
  )
  assert.equal(result.exitCode, 1)
  assert.match(result.output, /spawn unavailable/)
  assert.equal(calls[0].stdio, 'inherit')
  assert.equal(calls[0].shell, false)
})
