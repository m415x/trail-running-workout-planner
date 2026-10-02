import assert from 'node:assert/strict'
import test from 'node:test'

import { checkLocalSandboxReadOnlyCluster } from '../../lib/sandbox/local-identity-preflight'

const local = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const root = '/workspace/trail-running-workout-planner'
const pin = '1234567890123456789'

function fixture(database: string, physicalCluster: string) {
  const calls: string[] = []
  return {
    calls,
    input: {
      repositoryRoot: root,
      directUrl: local,
      loadApprovedPin: async () => { calls.push('pin'); return pin },
      createClient: () => {
        calls.push('client')
        return {
          reserve: async () => {
            calls.push('reserve')
            return {
              unsafe: async (_sql: string) => {
                calls.push('select')
                return [{
                  database,
                  environmentMarker: null,
                  clusterSystemIdentifier: physicalCluster,
                }]
              },
              release: async () => { calls.push('release') },
            }
          },
          end: async () => { calls.push('end') },
        }
      },
    },
  }
}

test('KAN-585 accepts the approved physical cluster even with no session marker', async () => {
  const f = fixture('postgres', pin)
  assert.deepEqual(await checkLocalSandboxReadOnlyCluster(f.input), { verified: true })
  assert.deepEqual(f.calls, ['pin', 'client', 'reserve', 'select', 'release', 'end'])
})

test('KAN-585 closes the same reserved session on physical mismatch without setting a marker', async () => {
  const f = fixture('postgres', 'different-cluster')
  await assert.rejects(() => checkLocalSandboxReadOnlyCluster(f.input), /cluster|identity/i)
  assert.deepEqual(f.calls, ['pin', 'client', 'reserve', 'select', 'release', 'end'])
})

test('KAN-585 rejects a nonlocal destination before loading pin or creating a client', async () => {
  const f = fixture('postgres', pin)
  await assert.rejects(() => checkLocalSandboxReadOnlyCluster({
    ...f.input,
    directUrl: 'postgresql://postgres:secret@production.example:5432/postgres',
  }), /local|sandbox|endpoint/i)
  assert.deepEqual(f.calls, [])
})
