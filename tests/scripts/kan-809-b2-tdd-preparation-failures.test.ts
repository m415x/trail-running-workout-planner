import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'
import {
  formatPreparationFailure,
  readFocusedTestSource,
} from '@/scripts/tdd'

test('KAN-809/B2 preparation failures never masquerade as functional RED or GREEN', () => {
  const sync = formatPreparationFailure('sync', 'fatal: unable to fast-forward')
  const missing = formatPreparationFailure('input', 'ENOENT: missing focused test')

  for (const message of [sync, missing]) {
    assert.match(message, /preparation/i)
    assert.doesNotMatch(message, /\\b(?:RED|GREEN)\\b/)
  }
  assert.match(sync, /unable to fast-forward/)
  assert.match(missing, /ENOENT/)
})

test('KAN-809/B2 missing focused file becomes controlled preparation error, not raw ENOENT', () => {
  const absent = join('tests', 'scripts', '__kan809_preparation_absent__.test.ts')
  assert.throws(
    () => readFocusedTestSource(absent),
    (error: unknown) => error instanceof Error &&
      /preparation/i.test(error.message) &&
      /ENOENT/.test(error.message) &&
      error.name !== 'Error',
  )
})

test('KAN-809/B2 readable ordinary files retain their original content for PG classification', () => {
  const source = readFocusedTestSource('tests/scripts/kan-725-harness-v2-contract.test.ts')
  assert.match(source, /KAN-725/)
})
