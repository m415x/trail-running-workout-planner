import assert from 'node:assert/strict'
import test from 'node:test'

import { validateTestRunnerArguments, assertSafePostgresRegressionTarget } from '@/scripts/test-runner'

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
