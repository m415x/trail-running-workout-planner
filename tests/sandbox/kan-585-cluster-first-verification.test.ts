import assert from 'node:assert/strict'
import test from 'node:test'

import { verifyLocalSandboxClusterPin } from '../../lib/sandbox/postgres-physical-identity'

const expectedClusterSystemIdentifier = '1234567890123456789'

test('KAN-585 verifies a PostgreSQL cluster pin before any session marker exists', async () => {
  let queries = 0
  const result = await verifyLocalSandboxClusterPin({
    expectedClusterSystemIdentifier,
    queryIdentity: async () => {
      queries++
      return {
        database: 'postgres',
        environmentMarker: null,
        clusterSystemIdentifier: expectedClusterSystemIdentifier,
      }
    },
  })
  assert.deepEqual(result, { database: 'postgres', clusterSystemIdentifier: expectedClusterSystemIdentifier })
  assert.equal(queries, 1)
})

test('KAN-585 rejects missing trusted pin before querying PostgreSQL', async () => {
  let queries = 0
  await assert.rejects(() => verifyLocalSandboxClusterPin({
    expectedClusterSystemIdentifier: undefined,
    queryIdentity: async () => {
      queries++
      return { database: 'postgres', clusterSystemIdentifier: expectedClusterSystemIdentifier }
    },
  }), /pin|cluster|identity/i)
  assert.equal(queries, 0)
})

test('KAN-585 rejects a copied marker when cluster or database differs', async () => {
  for (const row of [
    { database: 'postgres', environmentMarker: 'trail-running-coach-local-sandbox', clusterSystemIdentifier: '999' },
    { database: 'production', environmentMarker: 'trail-running-coach-local-sandbox', clusterSystemIdentifier: expectedClusterSystemIdentifier },
    { database: 'postgres', environmentMarker: 'trail-running-coach-local-sandbox', clusterSystemIdentifier: null },
  ]) {
    await assert.rejects(
      () => verifyLocalSandboxClusterPin({
        expectedClusterSystemIdentifier,
        queryIdentity: async () => row,
      }),
      /cluster|identity/i,
    )
  }
})

test('KAN-585 hides SQL errors and cannot promote mutable marker to authority', async () => {
  await assert.rejects(() => verifyLocalSandboxClusterPin({
    expectedClusterSystemIdentifier,
    queryIdentity: async () => { throw new Error('postgresql://postgres:password=SECRET@localhost') },
  }), (error: unknown) => error instanceof Error
    && /cluster|identity/i.test(error.message)
    && !error.message.includes('SECRET'))
})
