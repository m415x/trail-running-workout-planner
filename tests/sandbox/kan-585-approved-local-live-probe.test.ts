import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import test from 'node:test'

import { probeApprovedLocalPostgresJsDrizzle } from '../../lib/sandbox/approved-local-drizzle-probe'

const root = process.cwd()
const url = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const pin = '1234567890123456789'
const pinDocument = JSON.stringify({
  kind: 'coach-supabase-local',
  projectId: 'trail-running-workout-planner',
  approvedByOperator: true,
  approvedClusterSystemIdentifier: pin,
})

function driverFixture() {
  const events: string[] = []
  return {
    events,
    openDriver: async () => {
      events.push('OPEN')
      return {
        database: {
          transaction: async (callback: (tx: {
            execute: (sql: string) => Promise<readonly Record<string, string | null>[]>
          }) => Promise<void>) => {
            events.push('BEGIN')
            await callback({
              execute: async sql => {
                if (sql.includes('pg_control_system()')) return [{ database: 'postgres', clusterSystemIdentifier: pin }]
                if (sql.includes('set_config(') || sql.includes('current_setting(')) {
                  return [{ environmentMarker: 'trail-running-coach-local-sandbox' }]
                }
                if (sql.includes('to_regclass(')) return [{ journal: null }]
                throw new Error('Unexpected SQL')
              },
            })
            events.push('COMMIT')
          },
        },
        close: async () => { events.push('CLOSE') },
      }
    },
  }
}

test('KAN-585 reads independently approved local cluster pin before creating any real driver', async () => {
  const f = driverFixture()
  const reads: string[] = []
  const result = await probeApprovedLocalPostgresJsDrizzle({
    repositoryRoot: root,
    directUrl: url,
    readTrustedDocument: async path => {
      reads.push(path)
      return pinDocument
    },
    openDriver: f.openDriver,
  })
  assert.deepEqual(result, { verified: true, freshJournal: true })
  assert.deepEqual(reads, [resolve(root, '.coach-sandbox-local/approved-cluster.json')])
  assert.deepEqual(f.events, ['OPEN', 'BEGIN', 'COMMIT', 'CLOSE'])
})

test('KAN-585 refuses absent approval without opening any connection', async () => {
  const f = driverFixture()
  await assert.rejects(() => probeApprovedLocalPostgresJsDrizzle({
    repositoryRoot: root,
    directUrl: url,
    readTrustedDocument: async () => { throw new Error('C:\\PRIVATE\\secret') },
    openDriver: f.openDriver,
  }), error => error instanceof Error && !error.message.includes('PRIVATE')
    && /approved|pin|trusted/i.test(error.message))
  assert.deepEqual(f.events, [])
})

test('KAN-585 remote destination cannot trigger reading the approval document or opening driver', async () => {
  const f = driverFixture()
  let read = false
  await assert.rejects(() => probeApprovedLocalPostgresJsDrizzle({
    repositoryRoot: root,
    directUrl: 'postgresql://postgres:private@db.example.org:5432/postgres',
    readTrustedDocument: async () => { read = true; return pinDocument },
    openDriver: f.openDriver,
  }), /sandbox|local|endpoint/i)
  assert.equal(read, false)
  assert.deepEqual(f.events, [])
})
