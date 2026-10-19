import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareTestRunBatches } from '@/scripts/test-runner'

test('KAN-790 global test runner serializes shared PostgreSQL acceptance files', () => {
  const paths = [
    '/workspace/tests/domain/example.test.ts',
    '/workspace/tests/session-generation/kan-790-pg1-concurrent.test.ts',
    '/workspace/tests/session-generation/kan-790-pg4-authority.test.ts',
    '/workspace/tests/domain/another.test.ts',
  ]
  const batches = prepareTestRunBatches(paths)
  const pgBatches = batches.filter(batch => batch.args.some(arg =>
    /kan-790-pg[0-9]+-.*\.test\.ts$/.test(arg),
  ))
  assert.ok(pgBatches.length > 0)
  for (const batch of pgBatches) {
    assert.ok(batch.args.includes('--test-concurrency=1'),
      'global pn test must avoid parallel PG-1/PG-4 files in shared acceptance database')
  }
  const nonPgBatches = batches.filter(batch => !batch.args.some(arg =>
    /kan-790-pg[0-9]+-.*\.test\.ts$/.test(arg),
  ))
  assert.ok(nonPgBatches.length > 0,
    'isolation must not force unrelated tests into the PG lane')
})
