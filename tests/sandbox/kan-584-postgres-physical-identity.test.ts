import assert from 'node:assert/strict'
import test from 'node:test'

import { verifyLocalSandboxPhysicalIdentity } from '../../lib/sandbox/postgres-physical-identity'

type PhysicalRow = {
  database: string
  environmentMarker: string | null
  clusterSystemIdentifier: string
}

const expectedRow: PhysicalRow = {
  database: 'postgres',
  environmentMarker: 'trail-running-coach-local-sandbox',
  clusterSystemIdentifier: 'sandbox-cluster-12345',
}

test('KAN-584 verifies a real SQL identity result against an independent pinned cluster identifier', async () => {
  let calls = 0
  const result = await verifyLocalSandboxPhysicalIdentity({
    expectedClusterSystemIdentifier: 'sandbox-cluster-12345',
    queryIdentity: async () => {
      calls++
      return expectedRow
    },
  })
  assert.deepEqual(result, {
    database: 'postgres',
    environmentMarker: 'trail-running-coach-local-sandbox',
    projectRef: null,
  })
  assert.equal(calls, 1)
})

test('KAN-584 rejects a copied marker on a different physical PostgreSQL cluster', async () => {
  await assert.rejects(() => verifyLocalSandboxPhysicalIdentity({
    expectedClusterSystemIdentifier: 'allowed-local-cluster',
    queryIdentity: async () => expectedRow,
  }), /physical.*identity|cluster/i)
})

test('KAN-584 fails closed when trusted cluster pin is absent', async () => {
  let calls = 0
  await assert.rejects(() => verifyLocalSandboxPhysicalIdentity({
    expectedClusterSystemIdentifier: undefined,
    queryIdentity: async () => {
      calls++
      return expectedRow
    },
  }), /cluster.*pin|identity/i)
  assert.equal(calls, 0)
})

test('KAN-584 refuses malformed identity rows and hides SQL driver diagnostics', async () => {
  for (const queryIdentity of [
    async () => ({ ...expectedRow, database: 'production' }),
    async () => ({ ...expectedRow, environmentMarker: 'production' }),
    async () => ({ ...expectedRow, clusterSystemIdentifier: '' }),
    async () => { throw new Error('sensitive-password-do-not-print') },
  ]) {
    await assert.rejects(
      () => verifyLocalSandboxPhysicalIdentity({
        expectedClusterSystemIdentifier: 'sandbox-cluster-12345',
        queryIdentity,
      }),
      (error: unknown) => error instanceof Error
        && /identity|cluster/i.test(error.message)
        && !error.message.includes('sensitive-password-do-not-print'),
    )
  }
})
