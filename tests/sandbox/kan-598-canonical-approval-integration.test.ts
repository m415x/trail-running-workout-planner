import assert from 'node:assert/strict'
import test from 'node:test'

import { runApprovedCanonicalLocalDrizzleMigration } from '../../lib/sandbox/approved-canonical-local-drizzle-migration'

const root = process.cwd()
const url = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const pin = '1234567890123456789'
const document = JSON.stringify({
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

test('KAN-598 integrates canonical migration with one approved local Drizzle host and driver close', async () => {
  const calls: string[] = []
  const database = { transaction: () => { throw new Error('unused by injected runner') } }
  await runApprovedCanonicalLocalDrizzleMigration({
    repositoryRoot: root,
    directUrl: url,
    approval,
    readTrustedDocument: async () => { calls.push('pin'); return document },
    openDriver: async () => {
      calls.push('open')
      return { database, close: async () => { calls.push('close') } }
    },
    migrateCanonical: async input => {
      calls.push('canonical')
      assert.equal(input.repositoryRoot, root)
      assert.equal(input.directUrl, url)
      assert.equal(input.expectedClusterSystemIdentifier, pin)
      assert.equal(input.database, database)
    },
  })
  assert.deepEqual(calls, ['pin', 'open', 'canonical', 'close'])
})

test('KAN-598 refuses mismatched approval before constructing installed migration driver', async () => {
  let opened = false
  await assert.rejects(() => runApprovedCanonicalLocalDrizzleMigration({
    repositoryRoot: root,
    directUrl: url,
    approval: { ...approval, approvedClusterSystemIdentifier: '0000000000' },
    readTrustedDocument: async () => document,
    openDriver: async () => {
      opened = true
      throw new Error('unexpected open')
    },
    migrateCanonical: async () => { throw new Error('unexpected migrate') },
  }), /approval|cluster/i)
  assert.equal(opened, false)
})

test('KAN-598 closes the same canonical migration driver on failure and sanitizes errors', async () => {
  const events: string[] = []
  await assert.rejects(() => runApprovedCanonicalLocalDrizzleMigration({
    repositoryRoot: root,
    directUrl: url,
    approval,
    readTrustedDocument: async () => document,
    openDriver: async () => ({
      database: {},
      close: async () => { events.push('close') },
    }),
    migrateCanonical: async () => {
      throw new Error('password=SECRET_MUST_NOT_ESCAPE')
    },
  }), error => error instanceof Error
    && /migration|sandbox|failed/i.test(error.message)
    && !error.message.includes('SECRET_MUST_NOT_ESCAPE'))
  assert.deepEqual(events, ['close'])
})
