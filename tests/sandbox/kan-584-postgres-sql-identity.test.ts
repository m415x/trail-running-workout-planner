import assert from 'node:assert/strict'
import test from 'node:test'
import { readLocalSandboxSqlIdentity } from '../../lib/sandbox/postgres-sql-identity'

test('KAN-584 reads PostgreSQL cluster ID and database marker in one read-only SQL statement', async () => {
  const statements: string[] = []
  const rows = await readLocalSandboxSqlIdentity(async (statement) => {
    statements.push(statement)
    return [{
      database: 'postgres',
      environmentMarker: 'trail-running-coach-local-sandbox',
      clusterSystemIdentifier: '123456789',
    }]
  })

  assert.deepEqual(rows, {
    database: 'postgres',
    environmentMarker: 'trail-running-coach-local-sandbox',
    clusterSystemIdentifier: '123456789',
  })
  assert.equal(statements.length, 1)
  assert.match(statements[0], /current_database\s*\(/i)
  assert.match(statements[0], /current_setting\s*\(/i)
  assert.match(statements[0], /pg_control_system\s*\(/i)
  assert.doesNotMatch(statements[0], /\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i)
})

test('KAN-584 fails closed without exactly one PostgreSQL identity row', async () => {
  for (const rows of [[], [{ database: 'postgres' }, { database: 'postgres' }]]) {
    await assert.rejects(
      () => readLocalSandboxSqlIdentity(async () => rows),
      /identity/i,
    )
  }
})

test('KAN-584 hides PostgreSQL driver errors and never retries against another destination', async () => {
  let attempts = 0
  await assert.rejects(
    () => readLocalSandboxSqlIdentity(async () => {
      attempts++
      throw new Error('password=NEVER_PRINT_THIS')
    }),
    (error: unknown) => error instanceof Error
      && /identity/i.test(error.message)
      && !error.message.includes('NEVER_PRINT_THIS'),
  )
  assert.equal(attempts, 1)
})
