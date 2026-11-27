import assert from 'node:assert/strict'
import test from 'node:test'

import * as runtime from '@/scripts/acceptance-dev-child-env'

type TerminationPlan = { command: string; args: string[]; shell: boolean }
type BuildTerminationPlan = (input: { childPid: number; launcherPid: number }) => TerminationPlan

test('KAN-885/T3 L6 plans Windows child tree termination by owned PID without shell', () => {
  const candidate = (runtime as unknown as Record<string, unknown>)
    .buildAcceptanceDevWindowsTreeTerminationPlan
  assert.equal(typeof candidate, 'function', 'dedicated Windows tree termination plan must exist')
  const build = candidate as BuildTerminationPlan

  const plan = build({ childPid: 42420, launcherPid: 42419 })
  assert.equal(plan.command.toLowerCase(), 'taskkill.exe')
  assert.deepEqual(plan.args, ['/PID', '42420', '/T', '/F'])
  assert.equal(plan.shell, false, 'never interpolate a PID into a shell command')
  assert.deepEqual(build({ childPid: 42420, launcherPid: 42419 }), plan,
    'the same owned child must yield the same termination command')
})

test('KAN-885/T3 L6 refuses invalid or parent PIDs before any termination', () => {
  const build = (runtime as unknown as Record<string, unknown>)
    .buildAcceptanceDevWindowsTreeTerminationPlan as BuildTerminationPlan

  for (const childPid of [0, -1, 42.5, Number.NaN, Number.POSITIVE_INFINITY, 42419]) {
    assert.throws(
      () => build({ childPid, launcherPid: 42419 }),
      /PID|child|invalid|parent/i,
      'must never create a termination command for invalid or launcher PID',
    )
  }
  assert.throws(
    () => build({ childPid: 42420, launcherPid: 0 }),
    /PID|launcher|invalid/i,
  )
})
