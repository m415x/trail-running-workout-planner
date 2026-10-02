import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import { verifyCanonicalDrizzleSqlCorrespondence } from '../../lib/sandbox/drizzle-sql-correspondence'

const delimiter = '--> statement-breakpoint'
const sql0 = 'CREATE TABLE "users" ("id" text);'
const sql1 = 'ALTER TABLE "users" ADD COLUMN "name" text;'
const sql2 = 'CREATE TABLE "teams" ("id" text);'
const source = [
  { filename: '0000_first.sql', sql: [sql0, sql1].join(delimiter) },
  { filename: '0001_second.sql', sql: sql2 },
]
const migration = (sql: string, folderMillis: number) => ({
  sql: sql.split(delimiter),
  hash: createHash('sha256').update(sql).digest('hex'),
  folderMillis,
  bps: true,
})
const canonical = [migration(source[0].sql, 1), migration(source[1].sql, 2)]

test('KAN-585 verifies every inspected SQL file corresponds exactly to ordered Drizzle statements and SHA256', () => {
  assert.deepEqual(
    verifyCanonicalDrizzleSqlCorrespondence({ canonicalSqlInventory: source, migrations: canonical }),
    { verified: true, count: 2 },
  )
})

test('KAN-585 refuses altered SQL, swapped migration order, missing/extra files and incorrect hashes before DDL', () => {
  const failures = [
    { source: source.map((x, index) => index ? x : { ...x, sql: x.sql + '\n' }), migrations: canonical },
    { source: [source[1], source[0]], migrations: canonical },
    { source: source.slice(0, 1), migrations: canonical },
    { source: [...source, { filename: '0002_extra.sql', sql: 'SELECT 1' }], migrations: canonical },
    { source, migrations: [{ ...canonical[0], hash: 'not-matching' }, canonical[1]] },
    { source, migrations: [{ ...canonical[0], sql: [sql0 + ' -- mutated', sql1] }, canonical[1]] },
  ]
  for (const item of failures) {
    assert.throws(
      () => verifyCanonicalDrizzleSqlCorrespondence({
        canonicalSqlInventory: item.source,
        migrations: item.migrations,
      }),
      /canonical|migration|correspondence|hash|SQL/i,
    )
  }
})

test('KAN-585 rejects duplicate or unordered filename indexes and nonmonotonic journal timestamps', () => {
  for (const [files, entries] of [
    [[{ ...source[0], filename: '0000_first.sql' }, { ...source[1], filename: '0000_second.sql' }], canonical],
    [source, [canonical[0], { ...canonical[1], folderMillis: 1 }]],
    [[{ ...source[0], filename: '../0000_first.sql' }, source[1]], canonical],
  ] as const) {
    assert.throws(
      () => verifyCanonicalDrizzleSqlCorrespondence({ canonicalSqlInventory: files, migrations: entries }),
      /canonical|migration|correspondence|order/i,
    )
  }
})
