import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

import { loadCanonicalDrizzleMigrationMetadata } from '../../lib/sandbox/canonical-drizzle-migrations'
import { loadRepositoryCoachSandboxMigrationInventory } from '../../lib/sandbox/migration-inventory'

test('KAN-585 uses the installed Drizzle migrator reader and canonical migration hashes, without database connections', async () => {
  const repositoryRoot = process.cwd()
  const inventory = await loadRepositoryCoachSandboxMigrationInventory(repositoryRoot)
  const folder = resolve(repositoryRoot, 'drizzle/supabase')
  const migrations = loadCanonicalDrizzleMigrationMetadata({
    repositoryRoot,
    migrationsFolder: folder,
  })

  assert.equal(migrations.length, inventory.migrationCount)
  assert.equal(migrations.length, 29)
  assert.equal(migrations.every(m => /^[a-f0-9]{64}$/.test(m.hash)), true)
  assert.equal(migrations.every(m => m.sql.length > 0 && m.sql.every(sql => typeof sql === 'string')), true)
  assert.equal(migrations.every((m, idx) => idx === 0 || m.folderMillis > migrations[idx - 1].folderMillis), true)

  const firstSql = await readFile(resolve(folder, inventory.orderedMigrationFiles[0]), 'utf8')
  assert.equal(migrations[0].hash, createHash('sha256').update(firstSql).digest('hex'))
})

test('KAN-585 refuses a noncanonical migration folder before reading migration files', () => {
  for (const migrationsFolder of [
    '/tmp/unapproved-supabase-migrations',
    'drizzle/supabase',
  ]) {
    assert.throws(
      () => loadCanonicalDrizzleMigrationMetadata({ repositoryRoot: process.cwd(), migrationsFolder }),
      /canonical|sandbox|migration/i,
    )
  }
})
