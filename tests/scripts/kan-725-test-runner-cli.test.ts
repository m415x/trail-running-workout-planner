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


test('KAN-791 full regression refuses both preserved acceptance PostgreSQL databases', () => {
  for (const name of ['kan789_acceptance', 'kan791_acceptance_v2']) {
    assert.throws(
      () => assertSafePostgresRegressionTarget(`postgresql://postgres:placeholder@127.0.0.1:55439/${name}`),
      /BLOCKED: regression tests/,
    )
  }
  assert.doesNotThrow(() => assertSafePostgresRegressionTarget(undefined))
  assert.doesNotThrow(() => assertSafePostgresRegressionTarget('postgresql://postgres:placeholder@127.0.0.1:55439/kan791_regression_disposable'))
})
