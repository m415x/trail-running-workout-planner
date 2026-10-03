import assert from 'node:assert/strict'
import test from 'node:test'

import { runCoachSandboxWithReservedPostgres } from '../../lib/sandbox/postgres-driver'

const directUrl = 'postgresql://postgres:placeholder@127.0.0.1:54322/postgres'
const clusterId = '0123456789'

test('KAN-584 reserves one PostgreSQL connection for physical identity and guarded operation', async () => {
  const calls: string[] = []
  const connection = {
    unsafe: async (sql: string) => {
      assert.match(sql, /pg_control_system/i)
      calls.push('identity')
      return [{
        database: 'postgres',
        environmentMarker: 'trail-running-coach-local-sandbox',
        clusterSystemIdentifier: clusterId,
      }]
    },
    release: () => { calls.push('release') },
  }
  const result = await runCoachSandboxWithReservedPostgres({
    directUrl,
    operation: 'seed',
    confirmation: 'seed',
    expectedClusterSystemIdentifier: clusterId,
    createClient: () => {
      calls.push('client')
      return {
        reserve: async () => { calls.push('reserve'); return connection },
        end: async () => { calls.push('end') },
      }
    },
    execute: async (reserved) => {
      assert.equal(reserved, connection)
      calls.push('execute')
      return 'ok'
    },
  })

  assert.equal(result, 'ok')
  assert.deepEqual(calls, ['client', 'reserve', 'identity', 'execute', 'release', 'end'])
})

test('KAN-584 rejects unauthorized destination or missing pin before constructing PostgreSQL client', async () => {
  for (const [url, pin] of [
    [undefined, clusterId],
    ['postgresql://postgres:secret@localhost:5432/postgres', clusterId],
    [directUrl, undefined],
  ] as const) {
    let clients = 0
    await assert.rejects(() => runCoachSandboxWithReservedPostgres({
      directUrl: url,
      operation: 'seed',
    confirmation: 'seed',
      expectedClusterSystemIdentifier: pin,
      createClient: () => {
        clients++
        throw new Error('must not construct client')
      },
      execute: async () => 'unexpected',
    }), /sandbox|pin|direct URL/i)
    assert.equal(clients, 0)
  }
})

test('KAN-584 releases session and driver after identity mismatch without executing', async () => {
  const calls: string[] = []
  await assert.rejects(() => runCoachSandboxWithReservedPostgres({
    directUrl,
    operation: 'migrate',
    confirmation: 'migrate',
    expectedClusterSystemIdentifier: 'another-cluster',
    createClient: () => ({
      reserve: async () => ({
        unsafe: async () => [{
          database: 'postgres',
          environmentMarker: 'trail-running-coach-local-sandbox',
          clusterSystemIdentifier: clusterId,
        }],
        release: () => { calls.push('release') },
      }),
      end: async () => { calls.push('end') },
    }),
    execute: async () => { calls.push('execute') },
  }), /identity|cluster/i)
  assert.deepEqual(calls, ['release', 'end'])
})
