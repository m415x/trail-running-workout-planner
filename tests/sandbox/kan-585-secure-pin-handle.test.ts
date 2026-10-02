import assert from 'node:assert/strict'
import test from 'node:test'
import { join } from 'node:path'

import { loadApprovedLocalSandboxPinFile } from '../../lib/sandbox/local-pin-file'

const root = '/workspace/trail-running-workout-planner'
const document = JSON.stringify({
  kind: 'coach-supabase-local',
  projectId: 'trail-running-workout-planner',
  approvedClusterSystemIdentifier: '1234567890123456789',
  approvedByOperator: true,
})

test('KAN-585 reads the approved pin from one opened handle and closes it', async () => {
  let closed = 0
  let reads = 0
  let inspections = 0
  const approved = await loadApprovedLocalSandboxPinFile({
    repositoryRoot: root,
    inspectDirectory: async path => {
      assert.equal(path, join(root, '.coach-sandbox-local'))
      return { isDirectory: () => true, isSymbolicLink: () => false }
    },
    openFile: async (path, flags) => {
      assert.equal(path, join(root, '.coach-sandbox-local', 'approved-cluster.json'))
      assert.equal(typeof flags, 'number')
      return {
        stat: async () => {
          inspections++
          return { isFile: () => true, isSymbolicLink: () => false }
        },
        readFile: async () => { reads++; return document },
        close: async () => { closed++ },
      }
    },
  })
  assert.equal(approved, '1234567890123456789')
  assert.equal(inspections, 1)
  assert.equal(reads, 1)
  assert.equal(closed, 1)
})

test('KAN-585 rejects a symlinked approval directory before opening any file', async () => {
  let opened = false
  await assert.rejects(() => loadApprovedLocalSandboxPinFile({
    repositoryRoot: root,
    inspectDirectory: async () => ({
      isDirectory: () => true,
      isSymbolicLink: () => true,
    }),
    openFile: async () => {
      opened = true
      throw new Error('should never open')
    },
  }), /trusted|pin|approval/i)
  assert.equal(opened, false)
})

test('KAN-585 closes an opened handle on invalid content and hides sensitive diagnostics', async () => {
  let closed = 0
  await assert.rejects(() => loadApprovedLocalSandboxPinFile({
    repositoryRoot: root,
    inspectDirectory: async () => ({
      isDirectory: () => true,
      isSymbolicLink: () => false,
    }),
    openFile: async () => ({
      stat: async () => ({ isFile: () => true, isSymbolicLink: () => false }),
      readFile: async () => { throw new Error('password=SECRET') },
      close: async () => { closed++ },
    }),
  }), (error: unknown) => error instanceof Error
    && /trusted|pin|approval/i.test(error.message)
    && !error.message.includes('SECRET'))
  assert.equal(closed, 1)
})
