import assert from 'node:assert/strict'
import test from 'node:test'

import { probeLocalSandboxPostgresJsDrizzle } from '../../lib/sandbox/postgres-js-drizzle-probe'

const directUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const pin = '1234567890123456789'
const marker = 'trail-running-coach-local-sandbox'

function driverFixture(physical = pin) {
  const events: string[] = []
  const openDriver = async () => {
    events.push('OPEN')
    return {
      database: {
        transaction: async (callback: (tx: {
          execute: (statement: string) => Promise<readonly Record<string, string | null>[]>
        }) => Promise<void>) => {
          events.push('BEGIN')
          try {
            await callback({
              execute: async statement => {
                if (statement.includes('pg_control_system()')) return [
                  { database: 'postgres', clusterSystemIdentifier: physical },
                ]
                if (statement.includes('set_config(')) return [{ environmentMarker: marker }]
                if (statement.includes('current_setting(')) return [{ environmentMarker: marker }]
                if (statement.includes('to_regclass(')) return [{ journal: null }]
                throw new Error('Unexpected sandbox SQL')
              },
            })
            events.push('COMMIT')
          } catch (error) {
            events.push('ROLLBACK')
            throw error
          }
        },
      },
      close: async () => { events.push('CLOSE') },
    }
  }
  return { events, openDriver }
}

test('KAN-585 connects a real-driver adapter lifecycle to the verified read-only transaction probe', async () => {
  const f = driverFixture()
  assert.deepEqual(await probeLocalSandboxPostgresJsDrizzle({
    directUrl,
    expectedClusterSystemIdentifier: pin,
    openDriver: f.openDriver,
  }), { verified: true, freshJournal: true })
  assert.deepEqual(f.events, ['OPEN', 'BEGIN', 'COMMIT', 'CLOSE'])
})

test('KAN-585 closes the client after physical identity rejection and never hides the mismatch', async () => {
  const f = driverFixture('0000000000000000000')
  await assert.rejects(() => probeLocalSandboxPostgresJsDrizzle({
    directUrl,
    expectedClusterSystemIdentifier: pin,
    openDriver: f.openDriver,
  }), /cluster|physical|identity/i)
  assert.deepEqual(f.events, ['OPEN', 'BEGIN', 'ROLLBACK', 'CLOSE'])
})

test('KAN-585 rejects absent independent pin or remote URL BEFORE opening a driver', async () => {
  for (const request of [
    { directUrl, expectedClusterSystemIdentifier: undefined },
    { directUrl: 'postgresql://postgres:secret@remote.example.org:5432/postgres', expectedClusterSystemIdentifier: pin },
  ]) {
    const f = driverFixture()
    await assert.rejects(() => probeLocalSandboxPostgresJsDrizzle({
      ...request,
      openDriver: f.openDriver,
    }), /local|pin|cluster|sandbox/i)
    assert.deepEqual(f.events, [])
  }
})
