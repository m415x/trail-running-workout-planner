import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import * as runtime from '@/scripts/acceptance-dev-child-env'

type Child = EventEmitter & { pid?: number }
type Plan = { command: string; args: string[]; shell: false }
type Guard = { planTermination(): Plan; dispose(): void }
type CreateGuard = (input: { child: Child; launcherPid: number }) => Guard

function makeChild(pid?: number): Child {
  const child = new EventEmitter() as Child
  child.pid = pid
  return child
}

test('KAN-885/T3 L6 derives tree termination exclusively from live owned child handle', () => {
  const candidate = (runtime as unknown as Record<string, unknown>)
    .createAcceptanceDevOwnedChildTerminationGuard
  assert.equal(typeof candidate, 'function', 'owned child termination boundary must be exported')
  const create = candidate as CreateGuard
  const child = makeChild(42420)
  const guard = create({ child, launcherPid: 42419 })
  assert.deepEqual(guard.planTermination(), {
    command: 'taskkill.exe',
    args: ['/PID', '42420', '/T', '/F'],
    shell: false,
  })
  child.emit('close', 0, null)
  assert.throws(() => guard.planTermination(), /closed|finished|owned|child/i,
    'a closed child must not be targeted: its PID may have been reused')
  guard.dispose()
  guard.dispose()
})

test('KAN-885/T3 L6 rejects invalid child handles and disposed ownership', () => {
  const create = (runtime as unknown as Record<string, unknown>)
    .createAcceptanceDevOwnedChildTerminationGuard as CreateGuard
  for (const pid of [undefined, 0, -1, 42419]) {
    assert.throws(() => create({ child: makeChild(pid), launcherPid: 42419 }),
      /PID|child|invalid|owned/i)
  }

  const child = makeChild(42421)
  const guard = create({ child, launcherPid: 42419 })
  guard.dispose()
  assert.throws(() => guard.planTermination(), /closed|disposed|owned|child/i)
  assert.equal(child.listenerCount('close'), 0,
    'disposing a guard must not leak a child close listener')
})
