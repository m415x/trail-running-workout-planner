import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

import { loadVerifiedRepositoryDrizzleMigrationBundle } from '../../lib/sandbox/verified-drizzle-migration-bundle'
import { verifyCanonicalDrizzleSqlCorrespondence } from '../../lib/sandbox/drizzle-sql-correspondence'

test('KAN-585 assembles one authoritative bundle from PostgreSQL journal and canonical SQL files', async () => {
  const root = process.cwd()
  const result = await loadVerifiedRepositoryDrizzleMigrationBundle({ repositoryRoot: root })
  assert.equal(result.migrationsFolder, resolve(root, 'drizzle/supabase'))
  assert.equal(result.canonicalSqlInventory.length, 29)
  assert.equal(result.migrations.length, 29)
  assert.deepEqual(
    verifyCanonicalDrizzleSqlCorrespondence({
      canonicalSqlInventory: result.canonicalSqlInventory,
      migrations: result.migrations,
    }),
    { verified: true, count: 29 },
  )

  for (const [index, item] of result.canonicalSqlInventory.entries()) {
    assert.match(item.filename, new RegExp('^' + String(index).padStart(4, '0') + '_'))
    const sql = await readFile(resolve(result.migrationsFolder, item.filename), 'utf8')
    assert.equal(item.sql, sql)
    assert.equal(result.migrations[index].hash, createHash('sha256').update(sql).digest('hex'))
  }
})

test('KAN-585 rejects a foreign repository root rather than trusting another Drizzle journal', async () => {
  await assert.rejects(
    () => loadVerifiedRepositoryDrizzleMigrationBundle({
      repositoryRoot: resolve(process.cwd(), 'tests/sandbox'),
    }),
    /canonical|migration|journal|directory|SQL/i,
  )
})

test('KAN-585 refuses a changed SQL file between inventory and Drizzle reader without entering a transaction', async () => {
  const root = process.cwd()
  const source = await loadVerifiedRepositoryDrizzleMigrationBundle({ repositoryRoot: root })
  const modified = source.canonicalSqlInventory.map((file, index) =>
    index === 0 ? { ...file, sql: file.sql + '\n-- mutated after inventory' } : file
  )
  assert.throws(
    () => verifyCanonicalDrizzleSqlCorrespondence({
      canonicalSqlInventory: modified,
      migrations: source.migrations,
    }),
    /correspondence|hash|SQL|migration/i,
  )
})
