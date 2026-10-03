import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { inspectSandboxDestination } from '../../lib/sandbox/sandbox-destination'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

test('KAN-598/A1 rejects unsafe destination arguments without reporting credentials', () => {
  const secret = 'fixture-not-a-secret'
  const cases = [
    'postgresql://postgres:' + secret + '@localhost:54322/postgres',
    'postgresql://postgres:' + secret + '@127.0.0.1:54323/postgres',
    'postgresql://postgres:' + secret + '@127.0.0.1:54322/prod',
    'postgresql://postgres:' + secret + '@127.0.0.1:54322/postgres?sslmode=require',
  ]
  for (const directUrl of cases) {
    assert.throws(
      () => inspectSandboxDestination({ kind: 'local', directUrl }),
      (error: unknown) => error instanceof Error
        && !error.message.includes(secret)
        && /sandbox|endpoint/i.test(error.message),
    )
  }
})

test('KAN-598/A2 C14 operational module is still absent and the harness uses conspicuously fictitious credentials', () => {
  const harness = read('tests/sandbox/kan-598-bounded-operational-composition.test.ts')
  assert.match(harness, /fixture-not-a-secret/)
  assert.doesNotMatch(harness, /postgresql:\/\/postgres:postgres@/)
  assert.match(harness, /pendingModulePath/)
  assert.match(harness, /await import\(pendingModulePath\)/)
  assert.throws(
    () => read('scripts/coach-sandbox-migration-operation.ts'),
    (error: unknown) => error instanceof Error && 'code' in error && error.code === 'ENOENT',
  )
})

test('KAN-598/A3 installed composition requires explicit runtime authorization and has no import-time invocation', () => {
  const composition = read('lib/sandbox/installed-local-canonical-migration.ts')
  assert.match(composition, /authorizeExecution\?: \(\) => Promise<boolean>/)
  assert.match(composition, /authorized = \(await request\.authorizeExecution\?\.\(\)\) === true/)
  assert.match(composition, /if \(!authorized\)/)
  assert.match(composition, /beforeApprovedMigration: async \(\) =>/)
  assert.doesNotMatch(composition, /\bmain\s*\(/)
  const driver = read('lib/sandbox/local-postgres-js-drizzle-migration-driver.ts')
  assert.match(driver, /export function createLocalPostgresJsDrizzleMigrationDriver/)
  assert.doesNotMatch(driver, /^\s*(?:void\s+)?createLocalPostgresJsDrizzleMigrationDriver\(/m)
})
