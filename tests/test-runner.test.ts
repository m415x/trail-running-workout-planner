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


test('portable test runner aggregates batch summaries into one final result', async () => {
  const { aggregateTestRunSummaries } = await import('../scripts/test-runner')

  assert.deepEqual(aggregateTestRunSummaries([
    { tests: 335, suites: 31, pass: 335, fail: 0, cancelled: 0, skipped: 0, todo: 0, durationMs: 5806.0146 },
    { tests: 333, suites: 47, pass: 333, fail: 0, cancelled: 0, skipped: 0, todo: 0, durationMs: 6407.5506 },
    { tests: 268, suites: 67, pass: 268, fail: 0, cancelled: 0, skipped: 0, todo: 0, durationMs: 4891.6559 },
    { tests: 351, suites: 57, pass: 351, fail: 0, cancelled: 0, skipped: 0, todo: 0, durationMs: 10253.2463 },
    { tests: 88, suites: 14, pass: 88, fail: 0, cancelled: 0, skipped: 0, todo: 0, durationMs: 1753.8128 },
  ]), {
    tests: 1375,
    suites: 216,
    pass: 1375,
    fail: 0,
    cancelled: 0,
    skipped: 0,
    todo: 0,
    durationMs: 29112.2802,
  })
})


test('portable test runner parses a Node TAP batch summary without depending on test diagnostics', async () => {
  const { parseTestRunSummary } = await import('../scripts/test-runner')
  const output = `TAP version 13
# Subtest: example
ok 1 - example
1..1
# tests 3
# suites 1
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 42.125`

  assert.deepEqual(parseTestRunSummary(output), {
    tests: 3,
    suites: 1,
    pass: 3,
    fail: 0,
    cancelled: 0,
    skipped: 0,
    todo: 0,
    durationMs: 42.125,
  })
})

test('portable test runner rejects incomplete TAP summaries instead of inventing totals', async () => {
  const { parseTestRunSummary } = await import('../scripts/test-runner')

  assert.throws(
    () => parseTestRunSummary(`# tests 3
# pass 3
# fail 0`),
    /complete.*summary|summary.*complete/i,
  )
})


test('portable test runner separates TAP diagnostics from the batch summary', async () => {
  const { stripTestRunSummary } = await import('../scripts/test-runner')
  const output = `TAP version 13
# Subtest: example
ok 1 - example
1..1
# tests 1
# suites 1
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 12.5`

  assert.equal(stripTestRunSummary(output), `TAP version 13
# Subtest: example
ok 1 - example
1..1`)
})

test('portable test runner formats one aggregate Node-style summary', async () => {
  const { formatTestRunSummary } = await import('../scripts/test-runner')

  assert.equal(formatTestRunSummary({
    tests: 1375,
    suites: 216,
    pass: 1375,
    fail: 0,
    cancelled: 0,
    skipped: 0,
    todo: 0,
    durationMs: 29112.2802,
  }), `ℹ tests 1375
ℹ suites 216
ℹ pass 1375
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 29112.2802`)
})


test('portable test runner builds a captured TAP invocation for aggregate reporting', async () => {
  const { createTestBatchInvocation } = await import('../scripts/test-runner')
  const files = ['tests/a.test.ts', 'tests/b.test.ts']

  assert.deepEqual(createTestBatchInvocation(files), {
    args: ['--import', 'tsx', '--test', '--test-reporter=tap', ...files],
    options: {
      shell: false,
      encoding: 'utf8',
    },
  })
})


test('portable test runner prepares captured TAP batches for one aggregate result', async () => {
  const { prepareTestRunBatches } = await import('../scripts/test-runner')
  const files = ['tests/a.test.ts', 'tests/b.test.ts']

  assert.deepEqual(prepareTestRunBatches(files, 20), [
    {
      args: ['--import', 'tsx', '--test', '--test-reporter=tap', 'tests/a.test.ts'],
      options: { shell: false, encoding: 'utf8' },
    },
    {
      args: ['--import', 'tsx', '--test', '--test-reporter=tap', 'tests/b.test.ts'],
      options: { shell: false, encoding: 'utf8' },
    },
  ])
})


test('portable test runner combines captured TAP batch results into one report', async () => {
  const { combineTestBatchResults } = await import('../scripts/test-runner')
  const first = `TAP version 13
ok 1 - first
1..1
# tests 2
# suites 1
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 10.25`
  const second = `TAP version 13
ok 1 - second
1..1
# tests 3
# suites 2
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 20.5`

  assert.deepEqual(combineTestBatchResults([first, second]), {
    diagnostics: [`TAP version 13
ok 1 - first
1..1`, `TAP version 13
ok 1 - second
1..1`],
    summary: {
      tests: 5,
      suites: 3,
      pass: 5,
      fail: 0,
      cancelled: 0,
      skipped: 0,
      todo: 0,
      durationMs: 30.75,
    },
  })
})


test('portable test runner renders captured batches with one aggregate summary', async () => {
  const { renderTestBatchResults } = await import('../scripts/test-runner')
  const outputs = [
    `TAP version 13
ok 1 - first
1..1
# tests 2
# suites 1
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 10.25`,
    `TAP version 13
ok 1 - second
1..1
# tests 3
# suites 2
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 20.5`,
  ]

  assert.equal(renderTestBatchResults(outputs), `TAP version 13
ok 1 - first
1..1
TAP version 13
ok 1 - second
1..1
ℹ tests 5
ℹ suites 3
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 30.75`)
})


test('portable test runner executes prepared batches and emits one aggregate report', async () => {
  const { executeTestRunBatches } = await import('../scripts/test-runner')
  const invocations = [
    {
      args: ['--import', 'tsx', '--test', '--test-reporter=tap', 'tests/a.test.ts'],
      options: { shell: false as const, encoding: 'utf8' as const },
    },
    {
      args: ['--import', 'tsx', '--test', '--test-reporter=tap', 'tests/b.test.ts'],
      options: { shell: false as const, encoding: 'utf8' as const },
    },
  ]
  const outputs = [
    `TAP version 13
ok 1 - first
1..1
# tests 2
# suites 1
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 10.25`,
    `TAP version 13
ok 1 - second
1..1
# tests 3
# suites 2
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 20.5`,
  ]
  const calls: string[][] = []
  const reports: string[] = []

  const exitCode = executeTestRunBatches(
    invocations,
    (executable, args) => {
      calls.push([executable, ...args])
      const stdout = outputs[calls.length - 1]
      return { status: 0, signal: null, error: undefined, stdout, stderr: '' }
    },
    (report) => reports.push(report),
  )

  assert.equal(exitCode, 0)
  assert.equal(calls.length, 2)
  assert.equal(reports.length, 1)
  assert.match(reports[0] ?? '', /ℹ tests 5/)
  assert.doesNotMatch(reports[0] ?? '', /# tests [23]/)
})


test('portable test runner delegates the full inventory to captured aggregate execution', async () => {
  const { runTestFilesWith } = await import('../scripts/test-runner')
  const files = ['tests/a.test.ts', 'tests/b.test.ts']
  const reports: string[] = []
  const calls: string[][] = []
  const output = `TAP version 13
ok 1 - batch
1..1
# tests 2
# suites 1
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 12.5`

  const exitCode = runTestFilesWith(
    files,
    (executable, args) => {
      calls.push([executable, ...args])
      return { status: 0, signal: null, error: undefined, stdout: output, stderr: '' }
    },
    (report) => reports.push(report),
    8_000,
  )

  assert.equal(exitCode, 0)
  assert.equal(calls.length, 1)
  assert.ok(calls[0]?.includes('--test-reporter=tap'))
  assert.equal(reports.length, 1)
  assert.match(reports[0] ?? '', /ℹ tests 2/)
})
