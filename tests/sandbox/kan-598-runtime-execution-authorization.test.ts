import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import test from 'node:test'

import { runInstalledLocalCanonicalMigration } from '../../lib/sandbox/installed-local-canonical-migration'

const repositoryRoot = process.cwd()
const directUrl = 'postgresql://postgres:placeholder@127.0.0.1:54322/postgres'
const pin = '1234567890123456789'
const pinPath = resolve(repositoryRoot, '.coach-sandbox-local/approved-cluster.json')
const migrationPath = resolve(repositoryRoot, '.coach-sandbox-local/approved-migration.json')

async function readDocuments(path: string): Promise<string> {
  if (path === pinPath) return JSON.stringify({
    kind: 'coach-supabase-local',
    projectId: 'trail-running-workout-planner',
    approvedByOperator: true,
    approvedClusterSystemIdentifier: pin,
  })
  if (path === migrationPath) return JSON.stringify({
    operation: 'migrate',
    approvedByOperator: true,
    approvedClusterSystemIdentifier: pin,
  })
  throw new Error('Unexpected approval document')
}

test('KAN-598/C12 valid JSON documents alone must never open installed migration driver', async () => {
  let opened = false
  await assert.rejects(() => runInstalledLocalCanonicalMigration({
    repositoryRoot,
    directUrl,
    readTrustedDocument: readDocuments,
    openDriver: async () => {
      opened = true
      throw new Error('Unexpected driver construction')
    },
  }), /explicit|authorization|consent/i)
  assert.equal(opened, false)
})

test('KAN-598/C12 runtime execution authorization rejection blocks driver', async () => {
  let opened = false
  await assert.rejects(() => runInstalledLocalCanonicalMigration({
    repositoryRoot,
    directUrl,
    readTrustedDocument: readDocuments,
    authorizeExecution: async () => false,
    openDriver: async () => {
      opened = true
      throw new Error('Unexpected driver construction')
    },
  }), /authorization|consent|denied/i)
  assert.equal(opened, false)
})
