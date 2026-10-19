import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertSafeKan646BiometricPostgresTarget,
  isPostgresIntegrationSource,
  prepareTestRunBatches,
} from '@/scripts/test-runner'

const dedicated = 'postgres://biometric:local-only@127.0.0.1:55446/kan646_biometric_disposable'

test('KAN-646/T5 dedicated PostgreSQL guard accepts only isolated biometric fixture', () => {
  assert.doesNotThrow(() => assertSafeKan646BiometricPostgresTarget({ KAN646_PG_URL: dedicated }))
  for (const target of [
    undefined,
    'postgres://biometric:local-only@127.0.0.1:55439/kan791_regression_disposable',
    'postgres://biometric:local-only@127.0.0.1:55439/kan791_acceptance_v2',
    'postgres://biometric:local-only@127.0.0.1:55446/postgres',
    'postgres://biometric:local-only@localhost:55446/kan646_biometric_disposable',
    'postgres://biometric:local-only@127.0.0.1:55446/kan646_biometric_disposable?sslmode=disable',
    'postgres://biometric@127.0.0.1:55446/kan646_biometric_disposable',
  ]) {
    assert.throws(
      () => assertSafeKan646BiometricPostgresTarget({ KAN646_PG_URL: target }),
      /BLOCKED/,
    )
  }
})

test('KAN-646/T5 PG files join a guarded, serialized lane rather than ordinary suite', () => {
  const source = "const url = process.env.KAN646_PG_URL; import postgres from 'postgres';"
  assert.equal(isPostgresIntegrationSource(source), true)
  const batches = prepareTestRunBatches([
    '/repo/tests/physiology/kan-646-pg1-biometric-create.test.ts',
    '/repo/tests/physiology/kan-646-pg2-biometric-correction.test.ts',
    '/repo/tests/domain/unrelated.test.ts',
  ])
  const biometric = batches.filter(batch => batch.args.some(x => /kan-646-pg[12]-/.test(x)))
  assert.ok(biometric.length > 0)
  for (const batch of biometric) {
    assert.ok(batch.args.includes('--test-concurrency=1'))
    assert.ok(batch.args.filter(x => /kan-646-pg[12]-/.test(x)).length >= 1)
  }
})
