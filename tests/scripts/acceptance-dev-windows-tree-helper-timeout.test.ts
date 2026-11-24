import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import * as runtime from '@/scripts/acceptance-dev-child-env'

type TerminationPlan = { command: string; args: string[]; shell: false }
type TerminationProcess = EventEmitter & { kill(signal?: NodeJS.Signals): boolean }
type Execute = (input: {
  plan: TerminationPlan
  spawnTermination: () => TerminationProcess
  terminationTimeoutMs?: number
}) => Promise<void>

const plan: TerminationPlan = {
  command: 'taskkill.exe',
  args: ['/PID', '42420', '/T', '/F'],
  shell: false,
}

function fakeProcess(): { child: TerminationProcess; kills: string[] } {
  const child = new EventEmitter() as TerminationProcess
  const kills: string[] = []
  child.kill = (signal = 'SIGTERM') => {
    kills.push(signal)
    child.emit('close', null, signal)
    return true
  }
  return { child, kills }
}

test('KAN-885/T3 L6 bounds a hung taskkill helper and terminates only that helper', async () => {
  const candidate = (runtime as unknown as Record<string, unknown>)
    .executeAcceptanceDevWindowsTreeTermination
  assert.equal(typeof candidate, 'function')
  const execute = candidate as Execute
  const { child, kills } = fakeProcess()
  const result = execute({
    plan,
    spawnTermination: () => child,
    terminationTimeoutMs: 25,
  })
  let watchdog: ReturnType<typeof setTimeout> | undefined
  try {
    await assert.rejects(
      Promise.race([
        result,
        new Promise<never>((_, reject) => {
          watchdog = setTimeout(() => reject(new Error('test watchdog: taskkill remained pending')), 500)
        }),
      ]),
      /KAN-885.*(?:timeout|timed out|termination)/i,
    )
    assert.deepEqual(kills, ['SIGTERM'], 'timeout may kill only the spawned taskkill helper')
    assert.equal(child.listenerCount('close'), 0)
    assert.equal(child.listenerCount('error'), 0)
  } finally {
    if (watchdog) clearTimeout(watchdog)
  }
})

test('KAN-885/T3 L6 taskkill success cancels timeout without killing helper', async () => {
  const execute = (runtime as unknown as Record<string, unknown>)
    .executeAcceptanceDevWindowsTreeTermination as Execute
  const { child, kills } = fakeProcess()
  const result = execute({
    plan,
    spawnTermination: () => child,
    terminationTimeoutMs: 60,
  })
  child.emit('close', 0, null)
  await result
  assert.deepEqual(kills, [])
  assert.equal(child.listenerCount('close'), 0)
  assert.equal(child.listenerCount('error'), 0)
})
