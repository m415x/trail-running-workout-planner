import assert from 'node:assert/strict'
import test from 'node:test'

import { validateTestRunnerArguments } from '@/scripts/test-runner'

test('KAN-725 pn test remains full-suite only when no positional arguments are supplied', () => {
  assert.doesNotThrow(() => validateTestRunnerArguments([]))
})

test('KAN-725 pn test rejects test-file arguments and points to the focused TDD runners', () => {
  assert.throws(
    () => validateTestRunnerArguments(['tests/authorization/example.test.ts']),
    /pn test does not accept test paths[\s\S]*pn tdd:red[\s\S]*pn tdd/,
  )
})
