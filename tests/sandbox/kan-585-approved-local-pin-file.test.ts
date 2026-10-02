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

test('KAN-585 reads an explicitly scoped non-symlink operator approval file', async () => {
  const paths: string[] = []
  const pin = await loadApprovedLocalSandboxPinFile({
    repositoryRoot: root,
    inspect: async path => {
      paths.push(path)
      return { isFile: () => true, isSymbolicLink: () => false }
    },
    read: async path => {
      paths.push(path)
      return approvedDocument
    },
  })
  assert.equal(pin, '1234567890123456789')
  assert.deepEqual(paths, [approvedFile, approvedFile])
})

test('KAN-585 rejects symlinks, non-files, missing documents and unsafe roots without reading data', async () => {
  for (const stat of [
    { isFile: () => false, isSymbolicLink: () => false },
    { isFile: () => true, isSymbolicLink: () => true },
  ]) {
    let reads = 0
    await assert.rejects(
      () => loadApprovedLocalSandboxPinFile({
        repositoryRoot: root,
        inspect: async () => stat,
        read: async () => { reads++; return approvedDocument },
      }),
      /trusted|pin|approval/i,
    )
    assert.equal(reads, 0)
  }
  await assert.rejects(() => loadApprovedLocalSandboxPinFile({
    repositoryRoot: '.',
    inspect: async () => { throw new Error('should not inspect') },
    read: async () => approvedDocument,
  }), /trusted|pin|approval/i)
  await assert.rejects(() => loadApprovedLocalSandboxPinFile({
    repositoryRoot: root,
    inspect: async () => { throw new Error('password=PRIVATE') },
    read: async () => approvedDocument,
  }), (error: unknown) => error instanceof Error && !error.message.includes('PRIVATE'))
})

test('KAN-585 never versions operator approval files', async () => {
  const ignore = await readFile('.gitignore', 'utf8')
  assert.match(ignore, /^\/\.coach-sandbox-local\/$/m)
})
