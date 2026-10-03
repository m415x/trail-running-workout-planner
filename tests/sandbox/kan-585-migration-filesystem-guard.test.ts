import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import test from 'node:test'

import { inspectCanonicalMigrationFilesystemPaths } from '../../lib/sandbox/migration-filesystem-guard'

const root = resolve(process.cwd())
const files = ['0000_initial.sql', '0001_followup.sql']

function fixture(rejectedPath?: string) {
  const inspected: string[] = []
  const lstat = async (path: string) => {
    inspected.push(path)
    return {
      isSymbolicLink: () => path === rejectedPath,
      isDirectory: () => !path.endsWith('.sql') && !path.endsWith('.json'),
      isFile: () => path.endsWith('.sql') || path.endsWith('.json'),
    }
  }
  return { inspected, lstat }
}

test('KAN-585 inspects root, directories, journal and every canonical SQL source before reading', async () => {
  const f = fixture()
  await inspectCanonicalMigrationFilesystemPaths({
    repositoryRoot: root,
    orderedMigrationFiles: files,
    lstat: f.lstat,
  })
  assert.deepEqual(f.inspected, [
    root,
    resolve(root, 'drizzle'),
    resolve(root, 'drizzle/supabase'),
    resolve(root, 'drizzle/supabase/meta'),
    resolve(root, 'drizzle/supabase/meta/_journal.json'),
    resolve(root, 'drizzle/supabase/0000_initial.sql'),
    resolve(root, 'drizzle/supabase/0001_followup.sql'),
  ])
})

test('KAN-585 rejects symlink on any canonical filesystem boundary', async () => {
  for (const relative of [
    '.', 'drizzle', 'drizzle/supabase', 'drizzle/supabase/meta',
    'drizzle/supabase/meta/_journal.json', 'drizzle/supabase/0001_followup.sql',
  ]) {
    const f = fixture(resolve(root, relative))
    await assert.rejects(
      () => inspectCanonicalMigrationFilesystemPaths({
        repositoryRoot: root, orderedMigrationFiles: files, lstat: f.lstat,
      }),
      /symbolic|symlink|canonical|filesystem/i,
    )
  }
})

test('KAN-585 refuses unexpected filenames and non-file source before accessing SQL', async () => {
  for (const filename of ['../external.sql', '0000_../../external.sql', 'unsafe.sql']) {
    const f = fixture()
    await assert.rejects(
      () => inspectCanonicalMigrationFilesystemPaths({
        repositoryRoot: root, orderedMigrationFiles: [filename], lstat: f.lstat,
      }),
      /canonical|filename|migration/i,
    )
  }

  const f = fixture()
  await assert.rejects(
    () => inspectCanonicalMigrationFilesystemPaths({
      repositoryRoot: root,
      orderedMigrationFiles: files,
      lstat: async path => ({
        isSymbolicLink: () => false,
        isDirectory: () => path !== resolve(root, 'drizzle/supabase/0001_followup.sql'),
        isFile: () => path !== resolve(root, 'drizzle/supabase/0001_followup.sql'),
      }),
    }),
    /canonical|file|migration/i,
  )
})
