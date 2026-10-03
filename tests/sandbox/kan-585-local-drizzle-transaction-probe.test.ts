import assert from 'node:assert/strict'
import test from 'node:test'

import { probeVerifiedLocalDrizzleTransaction } from '../../lib/sandbox/local-drizzle-transaction-probe'

const localUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const pin = '1234567890123456789'
const marker = 'trail-running-coach-local-sandbox'

function fixture(options: { physical?: string; journal?: string | null } = {}) {
  const events: string[] = []
  const transaction = async (callback: (tx: {
    execute: (statement: string) => Promise<readonly Record<string, string | null>[]>
  }) => Promise<void>) => {
    events.push('BEGIN')
    try {
      await callback({
        execute: async statement => {
          if (statement.includes('pg_control_system()')) {
            events.push('IDENTITY')
            return [{ database: 'postgres', clusterSystemIdentifier: options.physical ?? pin }]
          }
          if (statement.includes('set_config(')) {
            events.push('MARKER')
            return [{ environmentMarker: marker }]
          }
          if (statement.includes('current_setting(')) {
            events.push('READBACK')
            return [{ environmentMarker: marker }]
          }
          if (statement.includes('to_regclass(')) {
            events.push('JOURNAL')
            return [{ journal: options.journal ?? null }]
          }
          throw new Error('Unexpected SQL')
        },
      })
      events.push('COMMIT')
    } catch (error) {
      events.push('ROLLBACK')
      throw error
    }
  }
  return { events, database: { transaction } }
}

test('KAN-585 probes identity, transaction-local marker and clean Drizzle journal without DDL', async () => {
  const f = fixture()
  const result = await probeVerifiedLocalDrizzleTransaction({
    directUrl: localUrl,
    expectedClusterSystemIdentifier: pin,
    database: f.database,
  })
  assert.deepEqual(result, { verified: true, freshJournal: true })
  assert.deepEqual(f.events, [
    'BEGIN', 'IDENTITY', 'MARKER', 'READBACK', 'JOURNAL', 'COMMIT',
  ])
})

test('KAN-585 refuses a foreign PostgreSQL cluster inside transaction before marker and journal', async () => {
  const f = fixture({ physical: '0000000000000000000' })
  await assert.rejects(() => probeVerifiedLocalDrizzleTransaction({
    directUrl: localUrl,
    expectedClusterSystemIdentifier: pin,
    database: f.database,
  }), /cluster|physical|identity/i)
  assert.deepEqual(f.events, ['BEGIN', 'IDENTITY', 'ROLLBACK'])
})

test('KAN-585 refuses an existing Drizzle journal, without calling any migrator', async () => {
  const f = fixture({ journal: 'drizzle.__drizzle_migrations' })
  await assert.rejects(() => probeVerifiedLocalDrizzleTransaction({
    directUrl: localUrl,
    expectedClusterSystemIdentifier: pin,
    database: f.database,
  }), /journal|fresh|migration/i)
  assert.deepEqual(f.events, [
    'BEGIN', 'IDENTITY', 'MARKER', 'READBACK', 'JOURNAL', 'ROLLBACK',
  ])
})

test('KAN-585 refuses remote URL before beginning a transaction', async () => {
  const f = fixture()
  await assert.rejects(() => probeVerifiedLocalDrizzleTransaction({
    directUrl: 'postgresql://postgres:secret@remote.example.org:5432/postgres',
    expectedClusterSystemIdentifier: pin,
    database: f.database,
  }), /sandbox|local|destination/i)
  assert.deepEqual(f.events, [])
})
