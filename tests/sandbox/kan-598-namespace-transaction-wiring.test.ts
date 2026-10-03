import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

test('KAN-598/C17 keeps read-only namespace guard in the verified migration transaction before dialect migration', () => {
  const source = readFileSync(
    join(process.cwd(), 'lib/sandbox/drizzle-transaction-boundary.ts'),
    'utf8',
  )

  const transaction = source.indexOf('await request.database.transaction(async tx => {')
  const journal = source.indexOf('await inspectCoachSandboxFreshMigrationTarget({ query })')
  const namespace = source.indexOf('await inspectCoachSandboxDrizzleNamespace({ query })')
  const collisions = source.indexOf('await inspectCoachSandboxApplicationTableCollisions({')
  const migration = source.indexOf('await request.database.dialect.migrate(')
  const transactionEnd = source.indexOf('phase = \'finish\'', migration)

  assert.ok(transaction >= 0, 'transaction boundary must exist')
  assert.ok(transaction < journal && journal < namespace)
  assert.ok(namespace < collisions && collisions < migration)
  assert.ok(transactionEnd > migration)
  assert.match(source, /namespace: 'Sandbox Drizzle namespace preflight failed'/)
  assert.match(source, /import \{ inspectCoachSandboxDrizzleNamespace \} from '\.\/drizzle-namespace-preflight'/)
})
