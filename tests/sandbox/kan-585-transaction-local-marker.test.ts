import assert from 'node:assert/strict'
import test from 'node:test'

import { verifyThenSetLocalSandboxSessionMarker } from '../../lib/sandbox/local-session-marker'

const pin = '1234567890123456789'
const marker = 'trail-running-coach-local-sandbox'

function fixture(physicalCluster = pin, database = 'postgres') {
  const statements: string[] = []
  let markerWrites = 0
  return {
    statements,
    get markerWrites() { return markerWrites },
    query: async (sql: string) => {
      statements.push(sql)
      if (sql.includes('set_config(')) {
        markerWrites++
        return [{ environmentMarker: marker }]
      }
      return [{
        database,
        environmentMarker: null,
        clusterSystemIdentifier: physicalCluster,
      }]
    },
  }
}

test('KAN-585 checks independently pinned physical cluster before setting a transaction-local marker', async () => {
  const f = fixture()
  const result = await verifyThenSetLocalSandboxSessionMarker({
    expectedClusterSystemIdentifier: pin,
    query: f.query,
    inExplicitTransaction: true,
  })
  assert.deepEqual(result, { markerEstablished: true })
  assert.equal(f.statements.length, 2)
  assert.match(f.statements[0], /pg_control_system\(\)/)
  assert.match(f.statements[1], /set_config\(/)
  assert.match(f.statements[1], /true\s*\)/i)
  assert.doesNotMatch(f.statements[1], /ALTER\s+(?:SYSTEM|ROLE|DATABASE)|SET\s+SESSION/i)
})

test('KAN-585 never sets a marker for a mismatched physical cluster or database', async () => {
  for (const f of [fixture('other-cluster'), fixture(pin, 'other-database')]) {
    await assert.rejects(() => verifyThenSetLocalSandboxSessionMarker({
      expectedClusterSystemIdentifier: pin,
      query: f.query,
      inExplicitTransaction: true,
    }), /cluster|identity|sandbox/i)
    assert.equal(f.markerWrites, 0)
    assert.equal(f.statements.length, 1)
  }
})

test('KAN-585 refuses marker setting without an explicit caller-owned transaction', async () => {
  const f = fixture()
  await assert.rejects(() => verifyThenSetLocalSandboxSessionMarker({
    expectedClusterSystemIdentifier: pin,
    query: f.query,
    inExplicitTransaction: false,
  }), /transaction|sandbox/i)
  assert.equal(f.statements.length, 0)
})

test('KAN-585 redacts physical query errors and never writes marker on failure', async () => {
  let queries = 0
  await assert.rejects(() => verifyThenSetLocalSandboxSessionMarker({
    expectedClusterSystemIdentifier: pin,
    inExplicitTransaction: true,
    query: async () => {
      queries++
      throw new Error('postgresql://secret-PASSWORD')
    },
  }), (error: unknown) => error instanceof Error
    && /identity|sandbox|cluster/i.test(error.message)
    && !error.message.includes('PASSWORD'))
  assert.equal(queries, 1)
})
