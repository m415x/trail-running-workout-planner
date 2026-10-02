import assert from 'node:assert/strict'
import test from 'node:test'

import {
  inspectCoachSandboxApplicationTableCollisions,
  extractCoachSandboxCreatedTables,
} from '../../lib/sandbox/application-table-collisions'

const migrations = [
  { filename: '0000_initial.sql', sql: 'CREATE TABLE "users" ("id" text);\nCREATE TABLE "teams" ("id" text);' },
  { filename: '0001_second.sql', sql: 'ALTER TABLE "users" ADD COLUMN "name" text;\nCREATE TABLE "athlete_groups" ("id" text);' },
]

test('KAN-585 derives application table names from canonical migration SQL, not a manual partial list', () => {
  assert.deepEqual(extractCoachSandboxCreatedTables(migrations), [
    'athlete_groups',
    'teams',
    'users',
  ])
})

test('KAN-585 performs one read-only public catalog inventory, permitting unrelated Supabase objects', async () => {
  const statements: string[] = []
  const result = await inspectCoachSandboxApplicationTableCollisions({
    migrations,
    query: async statement => {
      statements.push(statement)
      return [{ name: 'unrelated_supabase_table' }]
    },
  })
  assert.deepEqual(result, { noCollisions: true, checkedTables: 3 })
  assert.equal(statements.length, 1)
  assert.match(statements[0], /pg_catalog\.pg_class/i)
  assert.match(statements[0], /pg_catalog\.pg_namespace/i)
  assert.doesNotMatch(statements[0], /\b(?:CREATE|DROP|ALTER|INSERT|UPDATE|DELETE|TRUNCATE)\b/i)
})

test('KAN-585 rejects a single collision anywhere in the migration inventory', async () => {
  await assert.rejects(
    () => inspectCoachSandboxApplicationTableCollisions({
      migrations,
      query: async () => [{ name: 'unrelated_supabase_table' }, { name: 'athlete_groups' }],
    }),
    /collision|table|migration/i,
  )
})

test('KAN-585 fails closed on missing migrations, unrecognized CREATE TABLE, malformed catalog rows or SQL errors', async () => {
  assert.throws(() => extractCoachSandboxCreatedTables([]), /migration|table/i)
  assert.throws(() => extractCoachSandboxCreatedTables([
    { filename: '0000_unexpected.sql', sql: 'CREATE TABLE public.users (id text);' },
  ]), /migration|table|unsupported/i)

  for (const query of [
    async () => [{ name: false }],
    async () => [{ other: 'teams' }],
    async () => { throw new Error('postgresql://postgres:secret-DO-NOT-PRINT@localhost') },
  ]) {
    await assert.rejects(
      () => inspectCoachSandboxApplicationTableCollisions({ migrations, query }),
      (error: unknown) => error instanceof Error
        && /collision|catalog|migration|table/i.test(error.message)
        && !error.message.includes('DO-NOT-PRINT'),
    )
  }
})
