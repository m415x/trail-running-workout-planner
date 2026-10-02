import assert from 'node:assert/strict'
import test from 'node:test'

import { runPinnedCoachSandboxOperation } from '../../scripts/coach-sandbox-db'

const url = 'postgresql://postgres:fake-only@127.0.0.1:54322/postgres'
const pin = '1234567890'
const matching = {
  database: 'postgres',
  environmentMarker: 'trail-running-coach-local-sandbox',
  clusterSystemIdentifier: pin,
}

test('KAN-584 reads and pins physical SQL identity on the same connection as the mutation', async () => {
  const calls: string[] = []
  const connection = { query: async (statement: string) => {
    calls.push('sql')
    assert.match(statement, /pg_control_system/i)
    return [matching]
  } }
  const result = await runPinnedCoachSandboxOperation({
    directUrl: url,
    operation: 'seed',
    expectedClusterSystemIdentifier: pin,
    open: async () => { calls.push('open'); return connection },
    execute: async (active) => {
      assert.equal(active, connection)
      calls.push('execute')
      return 'seeded'
    },
    close: async (active) => {
      assert.equal(active, connection)
      calls.push('close')
    },
  })
  assert.equal(result, 'seeded')
  assert.deepEqual(calls, ['open', 'sql', 'execute', 'close'])
})

test('KAN-584 refuses missing pin before opening connection', async () => {
  let opened = false
  await assert.rejects(() => runPinnedCoachSandboxOperation({
    directUrl: url,
    operation: 'seed',
    expectedClusterSystemIdentifier: undefined,
    open: async () => { opened = true; return { query: async () => [matching] } },
    execute: async () => { throw new Error('mutation must not run') },
    close: async () => {},
  }), /pin|cluster/i)
  assert.equal(opened, false)
})

test('KAN-584 copied sandbox marker cannot bypass a mismatched physical cluster', async () => {
  let executed = false
  let closed = false
  await assert.rejects(() => runPinnedCoachSandboxOperation({
    directUrl: url,
    operation: 'migrate',
    expectedClusterSystemIdentifier: 'different-cluster',
    open: async () => ({ query: async () => [matching] }),
    execute: async () => { executed = true },
    close: async () => { closed = true },
  }), /cluster|identity/i)
  assert.equal(executed, false)
  assert.equal(closed, true)
})

test('KAN-584 invalid destination and reset never open a connection even with a valid pin', async () => {
  for (const [directUrl, operation] of [
    ['postgresql://postgres:password@db.production.supabase.co:5432/postgres?sslmode=require', 'seed'],
    [url, 'reset'],
  ] as const) {
    let opened = false
    await assert.rejects(() => runPinnedCoachSandboxOperation({
      directUrl,
      operation,
      expectedClusterSystemIdentifier: pin,
      open: async () => { opened = true; return { query: async () => [matching] } },
      execute: async () => { throw new Error('mutation must not run') },
      close: async () => {},
    }), /sandbox|endpoint|reset/i)
    assert.equal(opened, false)
  }
})
