import assert from 'node:assert/strict'
import test from 'node:test'

import * as probe from '@/scripts/acceptance-dev-windows-ctrlc-probe-state'

type State = {
  version: 1
  parentPid: number
  childPid: number
  port: number
  nonce: string
}
type Parse = (raw: string) => State

const valid = {
  version: 1,
  parentPid: 48301,
  childPid: 48302,
  port: 45678,
  nonce: 'b6f8188a8e81f031b5f87e12ad1b0c32',
}

test('KAN-885/T3 L6 accepts only a versioned, owner-bound, well-formed Ctrl+C probe record', () => {
  const candidate = (probe as unknown as Record<string, unknown>).parseAcceptanceDevCtrlcProbeState
  assert.equal(typeof candidate, 'function', 'Ctrl+C state parser must exist before enabling --verify')
  const parse = candidate as Parse
  assert.deepEqual(parse(JSON.stringify(valid)), valid)
})

test('KAN-885/T3 L6 fail-closes malformed and ambiguous Ctrl+C probe state', () => {
  const parse = (probe as unknown as Record<string, unknown>)
    .parseAcceptanceDevCtrlcProbeState as Parse
  const invalid = [
    '{broken',
    'null',
    '[]',
    '{}',
    JSON.stringify({ ...valid, version: 2 }),
    JSON.stringify({ ...valid, parentPid: -1 }),
    JSON.stringify({ ...valid, childPid: 0 }),
    JSON.stringify({ ...valid, parentPid: valid.childPid }),
    JSON.stringify({ ...valid, port: 65536 }),
    JSON.stringify({ ...valid, port: 0 }),
    JSON.stringify({ ...valid, nonce: '' }),
    JSON.stringify({ ...valid, nonce: 'not-a-secret' }),
    JSON.stringify({ ...valid, unexpected: 'extra' }),
  ]
  for (const raw of invalid) {
    assert.throws(() => parse(raw), /KAN-885/i, 'invalid probe state must fail closed')
  }
})
