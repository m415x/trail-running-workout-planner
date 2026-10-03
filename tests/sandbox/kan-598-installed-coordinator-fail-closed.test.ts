import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import test from 'node:test'

import { runInstalledLocalCanonicalMigration } from '../../lib/sandbox/installed-local-canonical-migration'

const root = process.cwd()
const url = 'postgresql://postgres:placeholder@127.0.0.1:54322/postgres'
const pin = '1234567890123456789'
const pinPath = resolve(root, '.coach-sandbox-local/approved-cluster.json')
const pinDocument = JSON.stringify({
  kind: 'coach-supabase-local',
  projectId: 'trail-running-workout-planner',
  approvedByOperator: true,
  approvedClusterSystemIdentifier: pin,
})

test('KAN-598/C10 operational coordinator never constructs migration driver without independent intent', async () => {
  const events: string[] = []
  await assert.rejects(() => runInstalledLocalCanonicalMigration({
    repositoryRoot: root,
    directUrl: url,
    readTrustedDocument: async path => {
      events.push(path === pinPath ? 'pin' : 'intent')
      if (path === pinPath) return pinDocument
      throw new Error('No separately approved migration intent')
    },
    openDriver: async () => {
      events.push('open')
      throw new Error('driver must not be opened')
    },
  }), /approval|unavailable/i)
  assert.deepEqual(events, ['pin', 'intent'])
})

test('KAN-598/C10 operational coordinator rejects remote URL before reading trust documents or opening driver', async () => {
  let read = false
  let opened = false
  await assert.rejects(() => runInstalledLocalCanonicalMigration({
    repositoryRoot: root,
    directUrl: 'postgresql://postgres:secret@db.example.org:5432/postgres',
    readTrustedDocument: async () => { read = true; return pinDocument },
    openDriver: async () => { opened = true; throw new Error('unexpected open') },
  }), /local|endpoint|sandbox/i)
  assert.equal(read, false)
  assert.equal(opened, false)
})

test('KAN-598/C10 operational coordinator rejects malformed pin document before any driver', async () => {
  let opened = false
  await assert.rejects(() => runInstalledLocalCanonicalMigration({
    repositoryRoot: root,
    directUrl: url,
    readTrustedDocument: async () => '{invalid',
    openDriver: async () => { opened = true; throw new Error('unexpected open') },
  }), /pin|approval|unavailable/i)
  assert.equal(opened, false)
})
