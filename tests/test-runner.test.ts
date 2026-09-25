import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

test('portable test discovery walks recursively and returns only sorted *.test.ts files', async () => {
  const { discoverTestFiles } = await import('../scripts/test-runner')
  const root = await mkdtemp(join(tmpdir(), 'test-discovery-'))

  await mkdir(join(root, 'nested', 'deeper'), { recursive: true })
  await writeFile(join(root, 'z.test.ts'), '')
  await writeFile(join(root, 'ignore.ts'), '')
  await writeFile(join(root, 'nested', 'b.test.ts'), '')
  await writeFile(join(root, 'nested', 'almost.test.tsx'), '')
  await writeFile(join(root, 'nested', 'deeper', 'a.test.ts'), '')

  assert.deepEqual(await discoverTestFiles(root), [
    join(root, 'nested', 'b.test.ts'),
    join(root, 'nested', 'deeper', 'a.test.ts'),
    join(root, 'z.test.ts'),
  ].sort())
})

test('portable test discovery rejects an empty inventory', async () => {
  const { discoverTestFiles } = await import('../scripts/test-runner')
  const root = await mkdtemp(join(tmpdir(), 'test-discovery-empty-'))

  await assert.rejects(() => discoverTestFiles(root), /No \.test\.ts files found/)
})

test('portable test discovery propagates traversal errors', async () => {
  const { discoverTestFiles } = await import('../scripts/test-runner')
  const missing = join(tmpdir(), 'missing-test-discovery-root')

  await assert.rejects(() => discoverTestFiles(missing))
})


test('portable test runner preserves child exit status', async () => {
  const { interpretTestRunResult } = await import('../scripts/test-runner')

  assert.deepEqual(interpretTestRunResult({ status: 7, signal: null, error: undefined }), {
    exitCode: 7,
    signal: null,
  })
})

test('portable test runner surfaces spawn errors', async () => {
  const { interpretTestRunResult } = await import('../scripts/test-runner')
  const error = new Error('spawn failed')

  assert.throws(
    () => interpretTestRunResult({ status: null, signal: null, error }),
    (thrown) => thrown === error,
  )
})

test('portable test runner preserves child termination signals', async () => {
  const { interpretTestRunResult } = await import('../scripts/test-runner')

  assert.deepEqual(interpretTestRunResult({ status: null, signal: 'SIGTERM', error: undefined }), {
    exitCode: null,
    signal: 'SIGTERM',
  })
})


test('portable test runner batches a large test inventory without losing deterministic order', async () => {
  const { planTestFileBatches } = await import('../scripts/test-runner')
  const files = Array.from({ length: 342 }, (_, index) =>
    join('C:\\DEV\\EPT-app\\trail-running-workout-planner\\tests', `suite-${String(index).padStart(3, '0')}.test.ts`),
  )

  const batches = planTestFileBatches(files, 8_000)

  assert.ok(batches.length > 1)
  assert.deepEqual(batches.flat(), files)
  assert.ok(batches.every((batch) =>
    batch.reduce((length, file) => length + file.length + 1, 0) <= 8_000,
  ))
})
