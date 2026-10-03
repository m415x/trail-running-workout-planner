import assert from 'node:assert/strict'
import test from 'node:test'

import { authorizeSandboxMutation } from '../../lib/sandbox/sandbox-operation-guard'

const local = {
  kind: 'local' as const,
  directUrl: 'postgresql://postgres:test-only@127.0.0.1:54322/postgres',
}
const identity = async () => ({
  database: 'postgres',
  environmentMarker: 'trail-running-coach-local-sandbox',
  projectRef: null,
})

test('KAN-584 never executes migration without an operation-specific confirmation', async () => {
  for (const confirmation of [undefined, 'seed', 'reset', 'yes']) {
    let identified = false
    let executed = false
    await assert.rejects(() => authorizeSandboxMutation({
      destination: local,
      operation: 'migrate',
      confirmation,
      readPhysicalIdentity: async () => {
        identified = true
        return identity()
      },
      execute: async () => { executed = true },
    }), /confirm|operation|approval/i)
    assert.equal(identified, false)
    assert.equal(executed, false)
  }
})

test('KAN-584 never accepts migration confirmation for a seed operation', async () => {
  let executed = false
  await assert.rejects(() => authorizeSandboxMutation({
    destination: local,
    operation: 'seed',
    confirmation: 'migrate',
    readPhysicalIdentity: identity,
    execute: async () => { executed = true },
  }), /confirm|operation|approval/i)
  assert.equal(executed, false)
})

test('KAN-584 operation-specific confirmation remains insufficient without physical identity', async () => {
  let executed = false
  await assert.rejects(() => authorizeSandboxMutation({
    destination: local,
    operation: 'migrate',
    confirmation: 'migrate',
    readPhysicalIdentity: async () => ({
      database: 'postgres',
      environmentMarker: 'foreign',
      projectRef: null,
    }),
    execute: async () => { executed = true },
  }), /identity|marker/i)
  assert.equal(executed, false)
})

test('KAN-584 permits a confirmed local seed only after matching identity', async () => {
  const order: string[] = []
  const result = await authorizeSandboxMutation({
    destination: local,
    operation: 'seed',
    confirmation: 'seed',
    readPhysicalIdentity: async () => {
      order.push('identity')
      return identity()
    },
    execute: async () => {
      order.push('execute')
      return 'ok'
    },
  })
  assert.equal(result, 'ok')
  assert.deepEqual(order, ['identity', 'execute'])
})
