import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

test('KAN-878 RED-15 dedicated PostgreSQL acceptance target is strictly isolated and fail-closed', async () => {
  const path = fileURLToPath(new URL('../../scripts/kan-878-postgres-acceptance-target.ts', import.meta.url))
  const importedModule = await import(pathToFileURL(path).href).catch(() => ({}))
  const assertTarget = Reflect.get(importedModule, 'assertSafeKan878PostgresTarget')
  assert.equal(typeof assertTarget, 'function', 'KAN-878 RED-15: dedicated PG acceptance target guard missing')

  const valid = 'postgresql://fixture:fixture@127.0.0.1:55478/kan878_vertical_disposable'
  assert.doesNotThrow(() => assertTarget({ KAN878_PG_URL: valid }))

  for (const candidate of [
    undefined,
    '',
    'not-a-url',
    'postgresql://fixture:fixture@127.0.0.1:55439/kan791_regression_disposable',
    'postgresql://fixture:fixture@127.0.0.1:55446/kan646_biometric_disposable',
    'postgresql://fixture:fixture@localhost:55478/kan878_vertical_disposable',
    'postgresql://fixture:fixture@remote.example.test:55478/kan878_vertical_disposable',
    'postgresql://fixture:fixture@127.0.0.1:55478/postgres',
    'postgresql://fixture:fixture@127.0.0.1:55478/kan878_vertical_disposable?sslmode=disable',
    'postgresql://fixture:fixture@127.0.0.1:55478/kan878_vertical_disposable#fragment',
    'postgresql://fixture@127.0.0.1:55478/kan878_vertical_disposable',
  ]) {
    assert.throws(
      () => assertTarget({ KAN878_PG_URL: candidate }),
      /BLOCKED|unauthoriz|invalid|required/i,
      `Unsafe or missing KAN878_PG_URL must be rejected: ${candidate ?? '<missing>'}`,
    )
  }
})
