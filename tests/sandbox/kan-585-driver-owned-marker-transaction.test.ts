import assert from 'node:assert/strict'
import test from 'node:test'

import { verifyLocalSandboxMarkerInTransaction } from '../../lib/sandbox/local-marker-transaction'

const pin = '1234567890123456789'
const marker = 'trail-running-coach-local-sandbox'
const directUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

function fixture(actualPin = pin) {
  const events: string[] = []
  const client = {
    begin: async (callback: (tx: { unsafe: (statement: string) => Promise<unknown[]> }) => Promise<unknown>) => {
      events.push('begin')
      try {
        const value = await callback({
          unsafe: async statement => {
            if (statement.includes('pg_control_system()')) {
              events.push('read-physical')
              return [{ database: 'postgres', environmentMarker: null, clusterSystemIdentifier: actualPin }]
            }
            if (statement.includes('set_config(')) {
              events.push('set-marker')
              return [{ environmentMarker: marker }]
            }
            if (statement.includes('current_setting(')) {
              events.push('read-marker')
              return [{ environmentMarker: marker }]
            }
            throw Error('unexpected SQL')
          },
        })
        events.push('commit')
        return value
      } catch (error) {
        events.push('rollback')
        throw error
      }
    },
    end: async () => { events.push('end') },
  }
  return { events, client }
}

test('KAN-585 opens a real driver-owned transaction before cluster verification or marker and closes afterward', async () => {
  const f = fixture()
  assert.deepEqual(await verifyLocalSandboxMarkerInTransaction({
    directUrl,
    expectedClusterSystemIdentifier: pin,
    createClient: () => f.client,
  }), { verified: true })
  assert.deepEqual(f.events, ['begin', 'read-physical', 'set-marker', 'read-marker', 'commit', 'end'])
})

test('KAN-585 denies mismatched cluster before marker, rolls back and closes', async () => {
  const f = fixture('different-cluster')
  await assert.rejects(() => verifyLocalSandboxMarkerInTransaction({
    directUrl,
    expectedClusterSystemIdentifier: pin,
    createClient: () => f.client,
  }), /cluster|identity|sandbox/i)
  assert.deepEqual(f.events, ['begin', 'read-physical', 'rollback', 'end'])
})

test('KAN-585 refuses absent pin and nonlocal destination before constructing driver', async () => {
  for (const input of [
    { directUrl, expectedClusterSystemIdentifier: undefined },
    { directUrl: 'postgresql://postgres:secret@db.example.com:5432/postgres', expectedClusterSystemIdentifier: pin },
  ]) {
    let started = 0
    await assert.rejects(() => verifyLocalSandboxMarkerInTransaction({
      ...input,
      createClient: () => { started++; return fixture().client },
    }), /pin|cluster|local|sandbox/i)
    assert.equal(started, 0)
  }
})
