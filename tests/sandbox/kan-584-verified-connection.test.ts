import assert from 'node:assert/strict'
import test from 'node:test'
import { withVerifiedLocalSandboxConnection } from '../../lib/sandbox/verified-sandbox-connection'

const directUrl = 'postgresql://postgres:example@127.0.0.1:54322/postgres'

test('KAN-584 uses the same connection for identification and execution', async () => {
  const connection = { marker: 'one' }
  const calls: string[] = []
  const result = await withVerifiedLocalSandboxConnection({
    directUrl,
    operation: 'seed',
    confirmation: 'seed',
    open: async () => connection,
    identify: async (db) => {
      assert.equal(db, connection)
      calls.push('identify')
      return { database: 'postgres', environmentMarker: 'trail-running-coach-local-sandbox', projectRef: null }
    },
    execute: async (db) => {
      assert.equal(db, connection)
      calls.push('execute')
      return 'ok'
    },
    close: async (db) => {
      assert.equal(db, connection)
      calls.push('close')
    },
  })
  assert.equal(result, 'ok')
  assert.deepEqual(calls, ['identify', 'execute', 'close'])
})

test('KAN-584 closes without executing on identity mismatch', async () => {
  let executed = false
  let closed = false
  await assert.rejects(() => withVerifiedLocalSandboxConnection({
    directUrl,
    operation: 'migrate',
    confirmation: 'migrate',
    open: async () => ({}),
    identify: async () => ({ database: 'postgres', environmentMarker: 'other', projectRef: null }),
    execute: async () => { executed = true },
    close: async () => { closed = true },
  }), /identity/i)
  assert.equal(executed, false)
  assert.equal(closed, true)
})

test('KAN-584 blocks reset before opening a connection', async () => {
  let opened = false
  await assert.rejects(() => withVerifiedLocalSandboxConnection({
    directUrl,
    operation: 'reset',
    open: async () => { opened = true; return {} },
    identify: async () => ({ database: 'postgres', environmentMarker: 'trail-running-coach-local-sandbox', projectRef: null }),
    execute: async () => {},
    close: async () => {},
  }), /reset/i)
  assert.equal(opened, false)
})
