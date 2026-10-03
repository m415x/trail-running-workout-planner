import assert from 'node:assert/strict'
import test from 'node:test'

import { inspectCoachSandboxDrizzleNamespace } from '../../lib/sandbox/drizzle-namespace-preflight'

test('KAN-598/C16 allows absent or empty Drizzle namespace without writing SQL', async () => {
  const statements: string[] = []
  const result = await inspectCoachSandboxDrizzleNamespace({
    query: async statement => {
      statements.push(statement)
      return []
    },
  })
  assert.deepEqual(result, { empty: true })
  assert.equal(statements.length, 1)
  assert.match(statements[0], /pg_catalog\.pg_class/i)
  assert.match(statements[0], /pg_catalog\.pg_namespace/i)
  assert.match(statements[0], /drizzle/)
  assert.match(statements[0], /^\s*SELECT\b/i)
  assert.doesNotMatch(statements[0], /\b(?:CREATE|DROP|ALTER|INSERT|UPDATE|DELETE|TRUNCATE)\s/i)
})

test('KAN-598/C16 rejects unexpected existing Drizzle namespace objects before migrations', async () => {
  await assert.rejects(
    () => inspectCoachSandboxDrizzleNamespace({
      query: async () => [{ name: 'legacy_journal' }],
    }),
    /drizzle|namespace|collision|preexisting/i,
  )
})

test('KAN-598/C16 fails closed on invalid namespace catalog and sanitizes driver failures', async () => {
  for (const query of [
    async () => [{ name: null }],
    async () => [{ other: 'legacy_journal' }],
    async () => { throw new Error('postgresql://postgres:secret-DO-NOT-LOG@127.0.0.1') },
  ]) {
    await assert.rejects(
      () => inspectCoachSandboxDrizzleNamespace({ query }),
      (error: unknown) => error instanceof Error
        && /drizzle|namespace|catalog|inspection/i.test(error.message)
        && !error.message.includes('secret-DO-NOT-LOG'),
    )
  }
})
