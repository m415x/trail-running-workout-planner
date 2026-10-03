import assert from 'node:assert/strict'
import { dirname, parse, resolve } from 'node:path'
import test from 'node:test'

import { inspectCanonicalRepositoryAncestorDirectories } from '../../lib/sandbox/migration-repository-ancestors'

const root = resolve(process.cwd())

function ancestors(directory: string) {
  const chain: string[] = []
  let current = dirname(directory)
  while (current !== parse(current).root) {
    chain.unshift(current)
    current = dirname(current)
  }
  chain.unshift(current)
  return chain
}

test('KAN-585 checks every ancestor directory of repository root, including filesystem root', async () => {
  const inspected: string[] = []
  await inspectCanonicalRepositoryAncestorDirectories({
    repositoryRoot: root,
    lstat: async path => {
      inspected.push(path)
      return {
        isDirectory: () => true,
        isSymbolicLink: () => false,
      }
    },
  })
  assert.deepEqual(inspected, ancestors(root))
})

test('KAN-585 refuses symbolic-link or non-directory ancestor before journal access', async () => {
  for (const rejected of ancestors(root)) {
    for (const kind of ['symbolic', 'not-directory']) {
      await assert.rejects(
        () => inspectCanonicalRepositoryAncestorDirectories({
          repositoryRoot: root,
          lstat: async path => ({
            isDirectory: () => path !== rejected || kind !== 'not-directory',
            isSymbolicLink: () => path === rejected && kind === 'symbolic',
          }),
        }),
        /canonical|symbolic|directory|filesystem/i,
      )
    }
  }
})

test('KAN-585 rejects a relative repository root without filesystem inspection', async () => {
  let inspected = false
  await assert.rejects(
    () => inspectCanonicalRepositoryAncestorDirectories({
      repositoryRoot: 'relative/project',
      lstat: async () => {
        inspected = true
        return { isDirectory: () => true, isSymbolicLink: () => false }
      },
    }),
    /absolute|canonical|repository/i,
  )
  assert.equal(inspected, false)
})
