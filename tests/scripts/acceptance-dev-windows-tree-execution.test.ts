import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import * as runtime from '@/scripts/acceptance-dev-child-env'

type TerminationPlan = { command: string; args: string[]; shell: false }
type TerminationProcess = EventEmitter
type SpawnTermination = (
  command: string,
  args: string[],
  options: { shell: false; stdio: 'ignore'; windowsHide: true },
) => TerminationProcess
type Execute = (input: {
  plan: TerminationPlan
  spawnTermination: SpawnTermination
}) => Promise<void>

const plan: TerminationPlan = {
  command: 'taskkill.exe',
  args: ['/PID', '42420', '/T', '/F'],
  shell: false,
}

test('KAN-885/T3 L6 executes only the approved tree-kill plan without a shell', async () => {
  const candidate = (runtime as unknown as Record<string, unknown>)
    .executeAcceptanceDevWindowsTreeTermination
  assert.equal(typeof candidate, 'function', 'Windows tree termination executor must exist')
  const execute = candidate as Execute

  const termination = new EventEmitter()
  let calls = 0
  const result = execute({
    plan,
    spawnTermination: (command, args, options) => {
      calls++
      assert.equal(command, 'taskkill.exe')
      assert.deepEqual(args, ['/PID', '42420', '/T', '/F'])
      assert.deepEqual(options, { shell: false, stdio: 'ignore', windowsHide: true })
      return termination
    },
  })
  termination.emit('close', 0, null)
  await result
  assert.equal(calls, 1)
  assert.equal(termination.listenerCount('close'), 0)
  assert.equal(termination.listenerCount('error'), 0)
})

test('KAN-885/T3 L6 fails closed for invalid plans and unsuccessful taskkill', async () => {
  const execute = (runtime as unknown as Record<string, unknown>)
    .executeAcceptanceDevWindowsTreeTermination as Execute
  let calls = 0
  const spawnTermination: SpawnTermination = () => {
    calls++
    return new EventEmitter()
  }

  for (const bad of [
    { ...plan, args: ['/PID', '42419', '/T', '/F', '/PID', '1'] },
    { ...plan, command: 'cmd.exe' },
    { ...plan, args: ['/PID', '0', '/T', '/F'] },
    { ...plan, shell: true as false },
  ]) {
    await assert.rejects(() => execute({ plan: bad, spawnTermination }), /KAN-885|invalid|termination/i)
  }
  assert.equal(calls, 0, 'invalid requests must not spawn any process')

  const termination = new EventEmitter()
  const failed = execute({
    plan,
    spawnTermination: () => termination,
  })
  termination.emit('close', 1, null)
  await assert.rejects(failed, /KAN-885|taskkill|termination/i)
  assert.equal(termination.listenerCount('error'), 0)
})
