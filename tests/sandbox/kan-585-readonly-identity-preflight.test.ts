import assert from 'node:assert/strict'
import test from 'node:test'

import { checkLocalSandboxReadOnlyIdentity } from '../../lib/sandbox/local-identity-preflight'

const directUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const repositoryRoot = '/workspace/trail-running-workout-planner'
const cluster = '1234567890123456789'

function harness(marker: string | null, actualCluster = cluster) {
  const events: string[] = []
  return {
    events,
    request: {
      repositoryRoot,
      directUrl,
      loadApprovedPin: async () => { events.push('load-pin'); return cluster },
      createClient: () => {
        events.push('create-client')
        return {
          reserve: async () => {
            events.push('reserve')
            return {
              unsafe: async (_sql: string) => {
                events.push('read-identity')
                return [{
                  database: 'postgres',
                  environmentMarker: marker,
                  clusterSystemIdentifier: actualCluster,
                }]
              },
              release: async () => { events.push('release') },
            }
          },
          end: async () => { events.push('end') },
        }
      },
    },
  }
}

test('KAN-585 read-only preflight verifies a pinned session and closes it without mutating', async () => {
  const h = harness('trail-running-coach-local-sandbox')
  assert.deepEqual(await checkLocalSandboxReadOnlyIdentity(h.request), { verified: true })
  assert.deepEqual(h.events, ['load-pin', 'create-client', 'reserve', 'read-identity', 'release', 'end'])
})

test('KAN-585 read-only preflight fails closed on the currently missing marker', async () => {
  const h = harness(null)
  await assert.rejects(() => checkLocalSandboxReadOnlyIdentity(h.request), /identity|marker|sandbox/i)
  assert.deepEqual(h.events, ['load-pin', 'create-client', 'reserve', 'read-identity', 'release', 'end'])
})

test('KAN-585 rejects cluster mismatch and nonlocal destination before DB writes', async () => {
  const mismatch = harness('trail-running-coach-local-sandbox', 'other-cluster')
  await assert.rejects(() => checkLocalSandboxReadOnlyIdentity(mismatch.request), /identity|cluster|sandbox/i)
  assert.deepEqual(mismatch.events.at(-2), 'release')
  assert.deepEqual(mismatch.events.at(-1), 'end')

  const wrong = harness('trail-running-coach-local-sandbox')
  await assert.rejects(() => checkLocalSandboxReadOnlyIdentity({
    ...wrong.request,
    directUrl: 'postgresql://postgres:postgres@db.production.example:5432/postgres',
  }), /local|sandbox|destination/i)
  assert.deepEqual(wrong.events, [])
})

test('KAN-585 rejects a missing approved pin before creating any database client', async () => {
  const h = harness('trail-running-coach-local-sandbox')
  await assert.rejects(() => checkLocalSandboxReadOnlyIdentity({
    ...h.request,
    loadApprovedPin: async () => { throw new Error('password=SECRET') },
  }), (error: unknown) => error instanceof Error
    && /pin|identity|sandbox/i.test(error.message)
    && !error.message.includes('SECRET'))
  assert.deepEqual(h.events, [])
})
