import assert from 'node:assert/strict'
import test from 'node:test'

import { inspectCoachSandboxFreshMigrationTarget } from '../../lib/sandbox/fresh-migration-target'

test('KAN-585 permits only an absent Drizzle journal before first application migration', async () => {
  const calls: string[] = []
  const result = await inspectCoachSandboxFreshMigrationTarget({
    query: async sql => {
      calls.push(sql)
      return [{ journal: null }]
    },
  })

  assert.deepEqual(result, { fresh: true })
  assert.equal(calls.length, 1)
  assert.match(calls[0], /to_regclass\s*\(/i)
  assert.match(calls[0], /drizzle\.__drizzle_migrations/)
  assert.doesNotMatch(calls[0], /\b(?:CREATE|DROP|ALTER|INSERT|UPDATE|DELETE|TRUNCATE)\b/i)
})

test('KAN-585 rejects a preexisting journal instead of assuming an empty target', async () => {
  await assert.rejects(() => inspectCoachSandboxFreshMigrationTarget({
    query: async () => [{ journal: 'drizzle.__drizzle_migrations' }],
  }), /journal|fresh|migration/i)
})

test('KAN-585 rejects malformed results and sanitizes database diagnostics', async () => {
  for (const query of [
    async () => [],
    async () => [{ journal: null }, { journal: null }],
    async () => [{ journal: false }],
    async () => { throw new Error('postgresql://postgres:secret-password@127.0.0.1:54322/postgres') },
  ]) {
    await assert.rejects(
      () => inspectCoachSandboxFreshMigrationTarget({ query }),
      (error: unknown) => error instanceof Error
        && /journal|fresh|migration/i.test(error.message)
        && !error.message.includes('secret-password'),
    )
  }
})
