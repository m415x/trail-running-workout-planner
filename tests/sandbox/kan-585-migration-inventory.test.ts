import assert from 'node:assert/strict'
import test from 'node:test'
import { loadCoachSandboxMigrationInventory } from '../../lib/sandbox/migration-inventory'

const journal = JSON.stringify({
  version: '7',
  dialect: 'postgresql',
  entries: [
    { idx: 0, version: '7', tag: '0000_first' },
    { idx: 1, version: '7', tag: '0001_second' },
  ],
})

test('KAN-585 reads only the existing canonical PostgreSQL Drizzle migration directory', async () => {
  const visited: string[] = []
  const result = await loadCoachSandboxMigrationInventory({
    readText: async (path) => {
      visited.push(path)
      return journal
    },
    listNames: async (path) => {
      visited.push(path)
      return ['meta', '0001_second.sql', 'README.md', '0000_first.sql']
    },
  })
  assert.deepEqual(result.orderedMigrationFiles, ['0000_first.sql', '0001_second.sql'])
  assert.equal(result.migrationCount, 2)
  assert.deepEqual(visited, [
    'drizzle/supabase/meta/_journal.json',
    'drizzle/supabase',
  ])
})

test('KAN-585 rejects corrupted journal without substituting a new migration authority', async () => {
  await assert.rejects(() => loadCoachSandboxMigrationInventory({
    readText: async () => '{bad',
    listNames: async () => ['0000_first.sql'],
  }), /migration|journal/i)
})

test('KAN-585 rejects missing migration files without constructing anything', async () => {
  await assert.rejects(() => loadCoachSandboxMigrationInventory({
    readText: async () => journal,
    listNames: async () => ['0000_first.sql'],
  }), /migration|drift/i)
})

test('KAN-585 redacts underlying filesystem diagnostics', async () => {
  await assert.rejects(() => loadCoachSandboxMigrationInventory({
    readText: async () => { throw new Error('private-path-password') },
    listNames: async () => [],
  }), (error: unknown) => error instanceof Error
    && /migration|journal/i.test(error.message)
    && !error.message.includes('private-path-password'))
})
