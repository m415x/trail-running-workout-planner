import assert from 'node:assert/strict'
import test from 'node:test'

import { validateTestRunnerArguments, assertSafePostgresRegressionTarget, isPostgresIntegrationSource, assertSafeAnnualPostgresTarget, isAnnualPostgresAcceptanceFile } from '@/scripts/test-runner'

test('KAN-725 pn test remains full-suite only when no positional arguments are supplied', () => {
  assert.doesNotThrow(() => validateTestRunnerArguments([]))
})

test('KAN-725 pn test rejects test-file arguments and points to the focused TDD runners', () => {
  assert.throws(
    () => validateTestRunnerArguments(['tests/authorization/example.test.ts']),
    /pn test does not accept test paths[\s\S]*pn tdd:red[\s\S]*pn tdd/,
  )
})


test('KAN-791 PostgreSQL regression target guard fails closed', () => {
  const keys = ['KAN789_PG_URL','SUPABASE_DATABASE_URL','SUPABASE_DIRECT_URL']
  const url = (name: string) => `postgresql://postgres:placeholder@127.0.0.1:55439/${name}`
  const vars = (name: string) => Object.fromEntries(keys.map(key=>[key,url(name)]))
  assert.throws(() => assertSafePostgresRegressionTarget({}), /required/)
  for (const name of ['kan789_acceptance','kan791_acceptance_v2']) {
    assert.throws(() => assertSafePostgresRegressionTarget(vars(name)), /unauthorized/)
  }
  assert.doesNotThrow(() => assertSafePostgresRegressionTarget(vars('kan791_regression_disposable')))
  const mismatched = vars('kan791_regression_disposable')
  mismatched.SUPABASE_DATABASE_URL = url('kan789_acceptance')
  assert.throws(() => assertSafePostgresRegressionTarget(mismatched), /unauthorized/)
  assert.throws(() => assertSafePostgresRegressionTarget({ ...vars('kan791_regression_disposable'), SUPABASE_DIRECT_URL: undefined }), /required/)
  assert.throws(() => assertSafePostgresRegressionTarget({ ...vars('kan791_regression_disposable'), SUPABASE_DIRECT_URL: 'postgresql://postgres:p@remote.example.com:5432/kan791_regression_disposable' }), /unauthorized/)
})

test('KAN-791 ordinary suite selects tests by real integration dependencies', () => {
  assert.equal(isPostgresIntegrationSource("const u = process.env.KAN789_PG_URL"), true)
  assert.equal(isPostgresIntegrationSource("const p = process.env.KAN791_AUTH_TEST_PASSWORD"), true)
  assert.equal(isPostgresIntegrationSource("test('KAN-791 structural contract', () => {})"), false)
  assert.equal(isPostgresIntegrationSource("const db = process.env.DATABASE_URL"), false)
})


test('KAN-791 annual read-only lane is explicit and never selected for disposable mutations', () => {
  const annual = 'tests/session-generation/kan-791-annual-239-postgres-effective-source.test.ts'
  assert.equal(isAnnualPostgresAcceptanceFile(annual), true)
  assert.equal(isAnnualPostgresAcceptanceFile('tests/auth/kan-791-dedicated-real-supabase-pg-coach.test.ts'), true)
  assert.equal(isAnnualPostgresAcceptanceFile('tests/auth/kan-791-pg-coach-provisioner-transaction.test.ts'), false)
  const url = (database: string) => 'postgresql://postgres:placeholder@127.0.0.1:55439/' + database
  assert.doesNotThrow(() => assertSafeAnnualPostgresTarget({KAN789_PG_URL: url('kan791_acceptance_v2')}))
  for (const database of ['kan789_acceptance','kan791_regression_disposable']) {
    assert.throws(() => assertSafeAnnualPostgresTarget({KAN789_PG_URL: url(database)}), /BLOCKED/)
  }
  assert.throws(() => assertSafeAnnualPostgresTarget({}), /BLOCKED/)
})
