import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import test from 'node:test'

import { withApprovedLocalMigrationGate } from '../../lib/sandbox/approved-local-migration-gate'

const root = process.cwd()
const url = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
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

test('KAN-598 refuses missing approval before constructing driver or running a transaction', async () => {
  const actions: string[] = []
  await assert.rejects(() => withApprovedLocalMigrationGate({
    repositoryRoot: root,
    directUrl: url,
    approval: undefined,
    readTrustedDocument: async path => {
      assert.equal(path, resolve(root, '.coach-sandbox-local/approved-cluster.json'))
      actions.push('pin')
      return pinDocument
    },
    runVerifiedMigration: async () => { actions.push('migrate') },
  }), /approval/i)
  assert.deepEqual(actions, ['pin'])
})

test('KAN-598 remote URLs fail before reading approval or invoking migration', async () => {
  const actions: string[] = []
  await assert.rejects(() => withApprovedLocalMigrationGate({
    repositoryRoot: root,
    directUrl: 'postgresql://postgres:private@db.example.org:5432/postgres',
    approval,
    readTrustedDocument: async () => { actions.push('pin'); return pinDocument },
    runVerifiedMigration: async () => { actions.push('migrate') },
  }), /local|sandbox|endpoint/i)
  assert.deepEqual(actions, [])
})

test('KAN-598 approved migration delegates exactly once only after independently read pin', async () => {
  const actions: string[] = []
  await withApprovedLocalMigrationGate({
    repositoryRoot: root,
    directUrl: url,
    approval,
    readTrustedDocument: async () => { actions.push('pin'); return pinDocument },
    runVerifiedMigration: async request => {
      actions.push('migrate')
      assert.deepEqual(request, {
        repositoryRoot: root,
        directUrl: url,
        expectedClusterSystemIdentifier: pin,
      })
    },
  })
  assert.deepEqual(actions, ['pin', 'migrate'])
})

test('KAN-598 rejects approval for another cluster without invoking migration', async () => {
  let migrated = false
  await assert.rejects(() => withApprovedLocalMigrationGate({
    repositoryRoot: root,
    directUrl: url,
    approval: { ...approval, approvedClusterSystemIdentifier: '55555555555555' },
    readTrustedDocument: async () => pinDocument,
    runVerifiedMigration: async () => { migrated = true },
  }), /approval|cluster/i)
  assert.equal(migrated, false)
})
