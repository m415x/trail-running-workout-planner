import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import test from 'node:test'

import { runIndependentlyApprovedCanonicalMigration } from '../../lib/sandbox/independently-approved-canonical-migration'

const repositoryRoot = process.cwd()
const directUrl = 'postgresql://postgres:placeholder@127.0.0.1:54322/postgres'
const pin = '1234567890123456789'
const pinPath = resolve(repositoryRoot, '.coach-sandbox-local/approved-cluster.json')
const migrationPath = resolve(repositoryRoot, '.coach-sandbox-local/approved-migration.json')
const pinJson = JSON.stringify({
  kind: 'coach-supabase-local',
  projectId: 'trail-running-workout-planner',
  approvedByOperator: true,
  approvedClusterSystemIdentifier: pin,
})
const migrationJson = JSON.stringify({
  operation: 'migrate',
  approvedByOperator: true,
  approvedClusterSystemIdentifier: pin,
})

test('KAN-598/C06 refuses missing independent migration intent before constructing driver', async () => {
  const events: string[] = []
  await assert.rejects(() => runIndependentlyApprovedCanonicalMigration({
    repositoryRoot,
    directUrl,
    readTrustedDocument: async path => {
      events.push(path === pinPath ? 'pin' : 'intent')
      if (path === pinPath) return pinJson
      throw new Error('not authorized')
    },
    openDriver: async () => { events.push('open'); throw new Error('unexpected driver') },
    migrateCanonical: async () => { events.push('migrate') },
  }), /approval|unavailable/i)
  assert.deepEqual(events, ['pin', 'intent'])
})

test('KAN-598/C06 delegates through approved canonical runner and closes its single driver', async () => {
  const events: string[] = []
  const database = { id: 'only-driver' }
  await runIndependentlyApprovedCanonicalMigration({
    repositoryRoot,
    directUrl,
    readTrustedDocument: async path => {
      events.push(path === pinPath ? 'pin' : 'intent')
      if (path === pinPath) return pinJson
      if (path === migrationPath) return migrationJson
      throw new Error('unrecognized document')
    },
    openDriver: async () => {
      events.push('open')
      return { database, close: async () => { events.push('close') } }
    },
    migrateCanonical: async request => {
      events.push('migrate')
      assert.equal(request.database, database)
      assert.equal(request.expectedClusterSystemIdentifier, pin)
      assert.equal(request.directUrl, directUrl)
      assert.equal(request.repositoryRoot, repositoryRoot)
    },
  })
  assert.deepEqual(events, ['pin', 'intent', 'pin', 'open', 'migrate', 'close'])
})

test('KAN-598/C06 mismatched migration intent blocks driver construction', async () => {
  let opened = false
  await assert.rejects(() => runIndependentlyApprovedCanonicalMigration({
    repositoryRoot,
    directUrl,
    readTrustedDocument: async path => path === pinPath ? pinJson : JSON.stringify({
      operation: 'migrate',
      approvedByOperator: true,
      approvedClusterSystemIdentifier: '9999999',
    }),
    openDriver: async () => { opened = true; throw new Error('unexpected driver') },
    migrateCanonical: async () => {},
  }), /approval|cluster/i)
  assert.equal(opened, false)
})
