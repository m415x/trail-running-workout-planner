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
