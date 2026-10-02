import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { loadApprovedLocalSandboxPinFile } from '../../lib/sandbox/local-pin-file'

const root = '/workspace/trail-running-workout-planner'
const approvedFile = join(root, '.coach-sandbox-local', 'approved-cluster.json')
const approvedDocument = JSON.stringify({
  kind: 'coach-supabase-local',
  projectId: 'trail-running-workout-planner',
  approvedClusterSystemIdentifier: '1234567890123456789',
  approvedByOperator: true,
})

test('KAN-585 only opens an explicitly scoped local operator approval file', async () => {
  const paths: string[] = []
  let closed = 0
  const pin = await loadApprovedLocalSandboxPinFile({
    repositoryRoot: root,
    inspectDirectory: async path => {
      paths.push(path)
      return { isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false }
    },
    openFile: async path => {
      paths.push(path)
      return {
        stat: async () => ({ isFile: () => true, isSymbolicLink: () => false }),
        readFile: async () => approvedDocument,
        close: async () => { closed++ },
      }
    },
  })
  assert.equal(pin, '1234567890123456789')
  assert.deepEqual(paths, [join(root, '.coach-sandbox-local'), approvedFile])
  assert.equal(closed, 1)
})

test('KAN-585 rejects symlinked or non-file approval handles and unsafe roots', async () => {
  for (const stat of [
    { isFile: () => false, isSymbolicLink: () => false },
    { isFile: () => true, isSymbolicLink: () => true },
  ]) {
    let reads = 0
    let closed = 0
    await assert.rejects(
      () => loadApprovedLocalSandboxPinFile({
        repositoryRoot: root,
        inspectDirectory: async () => ({ isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false }),
        openFile: async () => ({
          stat: async () => stat,
          readFile: async () => { reads++; return approvedDocument },
          close: async () => { closed++ },
        }),
      }),
      /trusted|pin|approval/i,
    )
    assert.equal(reads, 0)
    assert.equal(closed, 1)
  }
  await assert.rejects(() => loadApprovedLocalSandboxPinFile({
    repositoryRoot: '.',
    inspectDirectory: async () => { throw new Error('should not inspect') },
  }), /trusted|pin|approval/i)
  await assert.rejects(() => loadApprovedLocalSandboxPinFile({
    repositoryRoot: root,
    inspectDirectory: async () => { throw new Error('password=PRIVATE') },
  }), (error: unknown) => error instanceof Error && !error.message.includes('PRIVATE'))
})

test('KAN-585 never versions operator approval files', async () => {
  const ignore = await readFile('.gitignore', 'utf8')
  assert.match(ignore, /^\/\.coach-sandbox-local\/$/m)
})
