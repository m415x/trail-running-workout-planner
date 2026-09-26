import { spawnSync } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export async function discoverTestFiles(root: string): Promise<string[]> {
  const files: string[] = []

  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true })

    for (const entry of entries) {
      const path = resolve(directory, entry.name)

      if (entry.isDirectory()) {
        await walk(path)
      } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
        files.push(path)
      }
    }
  }

  await walk(root)
  files.sort()

  if (files.length === 0) {
    throw new Error(`No .test.ts files found under ${root}`)
  }

  return files
}

type TestRunResult = Pick<ReturnType<typeof spawnSync>, 'status' | 'signal' | 'error'>

export function interpretTestRunResult(result: TestRunResult): {
  exitCode: number | null
  signal: NodeJS.Signals | null
} {
  if (result.error) {
    throw result.error
  }

  if (result.signal) {
    return { exitCode: null, signal: result.signal }
  }

  return { exitCode: result.status ?? 1, signal: null }
}

export function planTestFileBatches(testFiles: string[], maxArgumentLength = 8_000): string[][] {
  const batches: string[][] = []
  let batch: string[] = []
  let argumentLength = 0

  for (const testFile of testFiles) {
    const nextLength = testFile.length + 1

    if (batch.length > 0 && argumentLength + nextLength > maxArgumentLength) {
      batches.push(batch)
      batch = []
      argumentLength = 0
    }

    batch.push(testFile)
    argumentLength += nextLength
  }

  if (batch.length > 0) {
    batches.push(batch)
  }

  return batches
}

type TestRunSummary = {
  tests: number
  suites: number
  pass: number
  fail: number
  cancelled: number
  skipped: number
  todo: number
  durationMs: number
}

export function parseTestRunSummary(output: string): TestRunSummary {
  const patterns = {
    tests: /^# tests (\d+)$/m,
    suites: /^# suites (\d+)$/m,
    pass: /^# pass (\d+)$/m,
    fail: /^# fail (\d+)$/m,
    cancelled: /^# cancelled (\d+)$/m,
    skipped: /^# skipped (\d+)$/m,
    todo: /^# todo (\d+)$/m,
    durationMs: /^# duration_ms ([\d.]+)$/m,
  } as const

  const values: Partial<TestRunSummary> = {}

  for (const [key, pattern] of Object.entries(patterns) as Array<
    [keyof TestRunSummary, RegExp]
  >) {
    const match = output.match(pattern)

    if (!match) {
      throw new Error('Node TAP output does not contain a complete test summary')
    }

    values[key] = Number(match[1])
  }

  return values as TestRunSummary
}

export function stripTestRunSummary(output: string): string {
  const summaryLine = /^# (?:tests|suites|pass|fail|cancelled|skipped|todo|duration_ms) (?:\d+(?:\.\d+)?)$/

  return output
    .split(/\r?\n/)
    .filter((line) => !summaryLine.test(line))
    .join('\n')
    .trimEnd()
}

export function formatTestRunSummary(summary: TestRunSummary): string {
  return [
    `ℹ tests ${summary.tests}`,
    `ℹ suites ${summary.suites}`,
    `ℹ pass ${summary.pass}`,
    `ℹ fail ${summary.fail}`,
    `ℹ cancelled ${summary.cancelled}`,
    `ℹ skipped ${summary.skipped}`,
    `ℹ todo ${summary.todo}`,
    `ℹ duration_ms ${summary.durationMs}`,
  ].join('\n')
}

export function aggregateTestRunSummaries(summaries: TestRunSummary[]): TestRunSummary {
  return summaries.reduce<TestRunSummary>((total, summary) => ({
    tests: total.tests + summary.tests,
    suites: total.suites + summary.suites,
    pass: total.pass + summary.pass,
    fail: total.fail + summary.fail,
    cancelled: total.cancelled + summary.cancelled,
    skipped: total.skipped + summary.skipped,
    todo: total.todo + summary.todo,
    durationMs: total.durationMs + summary.durationMs,
  }), {
    tests: 0,
    suites: 0,
    pass: 0,
    fail: 0,
    cancelled: 0,
    skipped: 0,
    todo: 0,
    durationMs: 0,
  })
}

export function createTestBatchInvocation(testFiles: string[]): {
  args: string[]
  options: {
    shell: false
    encoding: 'utf8'
  }
} {
  return {
    args: ['--import', 'tsx', '--test', '--test-reporter=tap', ...testFiles],
    options: {
      shell: false,
      encoding: 'utf8',
    },
  }
}

export function prepareTestRunBatches(
  testFiles: string[],
  maxArgumentLength = 8_000,
): ReturnType<typeof createTestBatchInvocation>[] {
  return planTestFileBatches(testFiles, maxArgumentLength).map(createTestBatchInvocation)
}

export function combineTestBatchResults(outputs: string[]): {
  diagnostics: string[]
  summary: TestRunSummary
} {
  return {
    diagnostics: outputs.map(stripTestRunSummary),
    summary: aggregateTestRunSummaries(outputs.map(parseTestRunSummary)),
  }
}

export function runTestFiles(testFiles: string[]): number {
  for (const batch of planTestFileBatches(testFiles)) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...batch], {
      shell: false,
      stdio: 'inherit',
    })
    const outcome = interpretTestRunResult(result)

    if (outcome.signal) {
      process.kill(process.pid, outcome.signal)
      return 1
    }

    if (outcome.exitCode !== 0) {
      return outcome.exitCode ?? 1
    }
  }

  return 0
}

async function main(): Promise<void> {
  const testFiles = await discoverTestFiles(resolve(process.cwd(), 'tests'))
  console.log(`Discovered ${testFiles.length} test files`)
  process.exitCode = runTestFiles(testFiles)
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
