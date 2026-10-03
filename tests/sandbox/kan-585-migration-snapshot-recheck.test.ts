import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import test from 'node:test'

import { verifyCanonicalMigrationSqlSnapshotUnchanged } from '../../lib/sandbox/migration-snapshot-recheck'
import { loadVerifiedRepositoryDrizzleMigrationBundle } from '../../lib/sandbox/verified-drizzle-migration-bundle'

const root = resolve(process.cwd())
const source = [
  { filename: '0000_initial.sql', sql: 'CREATE TABLE "synthetic" ("id" text);' },
  { filename: '0001_followup.sql', sql: 'ALTER TABLE "synthetic" ADD COLUMN "name" text;' },
]

test('KAN-585 rechecks exact SQL bytes from each canonical path after initial verification', async () => {
  const inspected: string[] = []
  await verifyCanonicalMigrationSqlSnapshotUnchanged({
    migrationsFolder: resolve(root, 'drizzle/supabase'),
    canonicalSqlInventory: source,
    readText: async path => {
      inspected.push(path)
      return source[inspected.length - 1].sql
    },
  })

  assert.deepEqual(inspected, source.map(file =>
    resolve(root, 'drizzle/supabase', file.filename)
  ))
})

test('KAN-585 refuses a changed file even when Drizzle metadata matched the earlier snapshot', async () => {
  const readText = async (path: string) => (
    path.endsWith('0001_followup.sql')
      ? 'ALTER TABLE "synthetic" DROP COLUMN "name";'
      : source[0].sql
  )
  await assert.rejects(
    () => verifyCanonicalMigrationSqlSnapshotUnchanged({
      migrationsFolder: resolve(root, 'drizzle/supabase'),
      canonicalSqlInventory: source,
      readText,
    }),
    /migration|snapshot|changed|canonical/i,
  )
})

test('KAN-585 fails closed on missing or unreadable SQL without leaking filesystem details', async () => {
  await assert.rejects(
    () => verifyCanonicalMigrationSqlSnapshotUnchanged({
      migrationsFolder: resolve(root, 'drizzle/supabase'),
      canonicalSqlInventory: source,
      readText: async () => { throw new Error('C:\\PRIVATE\\migration.sql') },
    }),
    error => error instanceof Error && /migration|snapshot|read/i.test(error.message)
      && !error.message.includes('PRIVATE'),
  )
})

test('KAN-585 rechecks all real canonical migration SQL without opening a database', async () => {
  const bundle = await loadVerifiedRepositoryDrizzleMigrationBundle({ repositoryRoot: root })
  await verifyCanonicalMigrationSqlSnapshotUnchanged({
    migrationsFolder: bundle.migrationsFolder,
    canonicalSqlInventory: bundle.canonicalSqlInventory,
  })
  assert.equal(bundle.canonicalSqlInventory.length, 29)
})
