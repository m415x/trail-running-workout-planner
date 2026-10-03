import assert from 'node:assert/strict'
import test from 'node:test'

import { runApprovedLocalDrizzleMigration } from '../../lib/sandbox/approved-local-drizzle-migration'

const root = process.cwd()
const directUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const pin = '1234567890123456789'
const pinDocument = JSON.stringify({
  kind: 'coach-supabase-local',
  projectId: 'trail-running-workout-planner',
  approvedByOperator: true,
  approvedClusterSystemIdentifier: pin,
})
const approval = {
  operation: 'migrate',
  approvedByOperator: true,
  approvedClusterSystemIdentifier: pin,
}

test('KAN-598 rejects missing migration approval before constructing Drizzle client', async () => {
  let opened = false
  await assert.rejects(() => runApprovedLocalDrizzleMigration({
    repositoryRoot: root,
    directUrl,
    approval: undefined,
    readTrustedDocument: async () => pinDocument,
    openDriver: async () => { opened = true; throw new Error('must not connect') },
    runMigration: async () => { throw new Error('must not migrate') },
  }), /approval/i)
  assert.equal(opened, false)
})

test('KAN-598 uses one opened driver for canonical migration and closes on success', async () => {
  const events: string[] = []
  const database = { marker: 'single-driver' }
  await runApprovedLocalDrizzleMigration({
    repositoryRoot: root,
    directUrl,
    approval,
    readTrustedDocument: async () => { events.push('pin'); return pinDocument },
    openDriver: async () => {
      events.push('open')
      return { database, close: async () => { events.push('close') } }
    },
    runMigration: async request => {
      events.push('migrate')
      assert.equal(request.repositoryRoot, root)
      assert.equal(request.directUrl, directUrl)
      assert.equal(request.expectedClusterSystemIdentifier, pin)
      assert.equal(request.database, database)
    },
  })
  assert.deepEqual(events, ['pin', 'open', 'migrate', 'close'])
})

test('KAN-598 closes driver on migration failure without exposing credentials', async () => {
  const events: string[] = []
  await assert.rejects(() => runApprovedLocalDrizzleMigration({
    repositoryRoot: root,
    directUrl,
    approval,
    readTrustedDocument: async () => pinDocument,
    openDriver: async () => ({
      database: {},
      close: async () => { events.push('close') },
    }),
    runMigration: async () => { throw new Error('postgresql://secret-private') },
  }), error => error instanceof Error
    && /migration|sandbox|failed/i.test(error.message)
    && !error.message.includes('secret-private'))
  assert.deepEqual(events, ['close'])
})

test('KAN-598 refuses remote destinations before opening a driver', async () => {
  let opened = false
  await assert.rejects(() => runApprovedLocalDrizzleMigration({
    repositoryRoot: root,
    directUrl: 'postgresql://postgres:secret@db.example.org:5432/postgres',
    approval,
    readTrustedDocument: async () => pinDocument,
    openDriver: async () => { opened = true; throw new Error('must not connect') },
    runMigration: async () => { throw new Error('must not migrate') },
  }), /local|sandbox|endpoint/i)
  assert.equal(opened, false)
})
