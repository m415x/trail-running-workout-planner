import assert from 'node:assert/strict'
import test from 'node:test'

import * as probe from '@/scripts/acceptance-dev-windows-ctrlc-probe-state'

type VerifyInput = {
  raw: string
  expectedNonce: string
  isPidAlive: (pid: number) => boolean | Promise<boolean>
  isPortAvailable: (port: number) => boolean | Promise<boolean>
}
type Verify = (input: VerifyInput) => Promise<void>

const state = {
  version: 1,
  parentPid: 48301,
  childPid: 48302,
  port: 45678,
  nonce: 'b6f8188a8e81f031b5f87e12ad1b0c32',
}
const raw = JSON.stringify(state)

test('KAN-885/T3 L6 verifies a matching run nonce, two absent PIDs and a released port without mutation', async () => {
  const candidate = (probe as unknown as Record<string, unknown>)
    .verifyAcceptanceDevCtrlcProbeState
  assert.equal(typeof candidate, 'function', 'read-only Ctrl+C verification boundary must exist')
  const verify = candidate as Verify
  const checkedPids: number[] = []
  const checkedPorts: number[] = []
  await verify({
    raw,
    expectedNonce: state.nonce,
    isPidAlive: pid => {
      checkedPids.push(pid)
      return false
    },
    isPortAvailable: async port => {
      checkedPorts.push(port)
      return true
    },
  })
  assert.deepEqual(checkedPids, [state.parentPid, state.childPid])
  assert.deepEqual(checkedPorts, [state.port])
})

test('KAN-885/T3 L6 refuses stale run nonce before probing OS state', async () => {
  const verify = (probe as unknown as Record<string, unknown>)
    .verifyAcceptanceDevCtrlcProbeState as Verify
  let checked = false
  await assert.rejects(verify({
    raw,
    expectedNonce: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    isPidAlive: () => { checked = true; return false },
    isPortAvailable: () => { checked = true; return true },
  }), /KAN-885/i)
  assert.equal(checked, false, 'an unrelated run must never reach PID or port checks')
})

test('KAN-885/T3 L6 rejects live parent, live descendant and occupied port independently', async () => {
  const verify = (probe as unknown as Record<string, unknown>)
    .verifyAcceptanceDevCtrlcProbeState as Verify
  for (const scenario of [
    { aliveParent: true, aliveChild: false, available: true },
    { aliveParent: false, aliveChild: true, available: true },
    { aliveParent: false, aliveChild: false, available: false },
  ]) {
    const queried: number[] = []
    await assert.rejects(verify({
      raw,
      expectedNonce: state.nonce,
      isPidAlive: async pid => {
        queried.push(pid)
        return pid === state.parentPid ? scenario.aliveParent : scenario.aliveChild
      },
      isPortAvailable: async () => scenario.available,
    }), /KAN-885/i)
    assert.ok(queried.every(pid => pid === state.parentPid || pid === state.childPid))
  }
})

test('KAN-885/T3 L6 sanitizes probe exceptions and rejects malformed input before OS inspection', async () => {
  const verify = (probe as unknown as Record<string, unknown>)
    .verifyAcceptanceDevCtrlcProbeState as Verify
  let called = false
  const input: VerifyInput = {
    raw: '{bad',
    expectedNonce: state.nonce,
    isPidAlive: () => { called = true; return false },
    isPortAvailable: () => { called = true; return true },
  }
  await assert.rejects(verify(input), /KAN-885/i)
  assert.equal(called, false)

  await assert.rejects(verify({
    ...input,
    raw,
    isPidAlive: () => { throw new Error('sensitive-user-directory') },
  }), error => {
    assert.ok(error instanceof Error)
    assert.match(error.message, /KAN-885/)
    assert.doesNotMatch(error.message, /sensitive-user-directory/)
    return true
  })
})
