import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import test from 'node:test'

import { withIndependentLocalMigrationApproval } from '../../lib/sandbox/independent-local-migration-approval'

const root = process.cwd()
const directUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const pin = '1234567890123456789'
const physical = JSON.stringify({
  kind: 'coach-supabase-local',
  projectId: 'trail-running-workout-planner',
  approvedByOperator: true,
  approvedClusterSystemIdentifier: pin,
})
const intent = JSON.stringify({
  operation: 'migrate',
  approvedByOperator: true,
  approvedClusterSystemIdentifier: pin,
})
const pinFile = resolve(root, '.coach-sandbox-local/approved-cluster.json')
const intentFile = resolve(root, '.coach-sandbox-local/approved-migration.json')

test('KAN-598 requires a separately readable migration approval document before delegation', async () => {
  const reads: string[] = []
  let delegated = false
  await assert.rejects(() => withIndependentLocalMigrationApproval({
    repositoryRoot: root,
    directUrl,
    readTrustedDocument: async path => {
      reads.push(path)
      if (path === pinFile) return physical
      throw new Error('migration approval not issued')
    },
    runApprovedMigration: async () => { delegated = true },
  }), /approval|unavailable|invalid/i)
  assert.deepEqual(reads, [pinFile, intentFile])
  assert.equal(delegated, false)
})

test('KAN-598 rejects a migration authorization for another local physical cluster', async () => {
  let delegated = false
  await assert.rejects(() => withIndependentLocalMigrationApproval({
    repositoryRoot: root,
    directUrl,
    readTrustedDocument: async path => path === pinFile
      ? physical
      : JSON.stringify({
        operation: 'migrate',
        approvedByOperator: true,
        approvedClusterSystemIdentifier: '998877665544',
      }),
    runApprovedMigration: async () => { delegated = true },
  }), /approval|cluster/i)
  assert.equal(delegated, false)
})

test('KAN-598 reads independent approvals and delegates exactly once only after both checks', async () => {
  const calls: string[] = []
  await withIndependentLocalMigrationApproval({
    repositoryRoot: root,
    directUrl,
    readTrustedDocument: async path => {
      calls.push(path)
      return path === pinFile ? physical : intent
    },
    runApprovedMigration: async value => {
      calls.push('delegate')
      assert.deepEqual(value, {
        repositoryRoot: root,
        directUrl,
        approval: JSON.parse(intent),
      })
    },
  })
  assert.deepEqual(calls, [pinFile, intentFile, 'delegate'])
})

test('KAN-598 refuses remote URL before reading either approval file', async () => {
  let read = false
  await assert.rejects(() => withIndependentLocalMigrationApproval({
    repositoryRoot: root,
    directUrl: 'postgresql://postgres:secret@remote.example.org:5432/postgres',
    readTrustedDocument: async () => { read = true; return physical },
    runApprovedMigration: async () => {},
  }), /local|sandbox|endpoint/i)
  assert.equal(read, false)
})
