import { spawnSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
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

export function isPostgresIntegrationSource(source: string): boolean {
  // Explicit connection/auth inputs identify integration files, not their issue IDs.
  return /process\.env\.(?:KAN789_PG_URL|KAN646_PG_URL|KAN791_AUTH_TEST_PASSWORD|KAN791_AUTH_TEST_EMAIL|KAN791_AUTH_SUBJECT)/.test(source) ||
    (/from 'postgres'/.test(source) && /signInWithPassword|\.begin\(|sql`|postgres\(url/.test(source))
}

export function isAnnualPostgresAcceptanceFile(path: string): boolean {
  const filename = path.replaceAll(String.fromCharCode(92), '/').split('/').pop() ?? ''
  return filename === 'kan-791-annual-239-postgres-effective-source.test.ts' ||
    filename === 'kan-791-dedicated-real-supabase-pg-coach.test.ts'
}

/** The preserved annual database may only be used by the audited read-only test. */
export function assertSafeAnnualPostgresTarget(env: Record<string, string | undefined>): void {
  const raw = env.KAN789_PG_URL
  if (!raw) throw new Error('BLOCKED: KAN789_PG_URL required for annual read-only acceptance')
  let target: URL
  try { target = new URL(raw) } catch { throw new Error('BLOCKED: invalid annual PostgreSQL URL') }
  if (!['postgres:', 'postgresql:'].includes(target.protocol) ||
      target.hostname !== '127.0.0.1' || target.port !== '55439' ||
      target.pathname !== '/kan791_acceptance_v2' || target.search || target.hash ||
      !target.username || !target.password) {
    throw new Error('BLOCKED: unauthorized annual PostgreSQL target')
  }
}

export async function partitionTestFiles(files: string[]): Promise<{
  ordinary: string[]; postgres: string[]
}> {
  const ordinary: string[] = []
  const postgres: string[] = []
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    ;(isPostgresIntegrationSource(source) ? postgres : ordinary).push(file)
  }
  return { ordinary, postgres }
}

type TestRunResult = Pick<ReturnType<typeof spawnSync>, 'status' | 'signal' | 'error'>

export function validateTestRunnerArguments(args: string[]): void {
  if (args.length === 0) return

  throw new Error(
    [
      'pn test does not accept test paths or positional arguments; it always runs the full suite.',
      'Use pn tdd:red <test-file> [...] for focused RED evidence.',
      'Use pn tdd <test-file> [...] for focused GREEN evidence plus the canonical typecheck.',
    ].join('\n'),
  )
}


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

function isSharedPostgresAcceptanceTest(path: string): boolean {
  const filename = path.replaceAll(String.fromCharCode(92), '/').split('/').pop() ?? ''
  return /^(?:kan-646-pg[0-9]+-|kan-790-pg[0-9]+-|kan-790-t55-.*pg-|kan-789-review-snapshot-postgres-|kan-791-(?:annual-239-postgres-|t6a-.*postgres-)).*\.test\.ts$/.test(filename)
}

/** Positive, fail-closed guard for the dedicated disposable PG regression lane. */
export function assertSafePostgresRegressionTarget(
  env: Record<string, string | undefined>,
): void {
  const keys = ['KAN789_PG_URL', 'SUPABASE_DATABASE_URL', 'SUPABASE_DIRECT_URL'] as const
  for (const key of keys) {
    const raw = env[key]
    if (!raw) throw new Error(`BLOCKED: ${key} required for PostgreSQL regressions`)
    let target: URL
    try { target = new URL(raw) } catch { throw new Error(`BLOCKED: invalid ${key}`) }
    if (!['postgres:', 'postgresql:'].includes(target.protocol) ||
        target.hostname !== '127.0.0.1' || target.port !== '55439' ||
        target.pathname !== '/kan791_regression_disposable' ||
        target.search || target.hash || !target.username || !target.password) {
      throw new Error(`BLOCKED: unauthorized regression target ${key}`)
    }
  }
}

/** KAN-646 uses a distinct, explicitly disposable PG instance; never reuse KAN-791. */
export function assertSafeKan646BiometricPostgresTarget(
  env: Record<string, string | undefined>,
): void {
  const raw = env.KAN646_PG_URL
  if (!raw) throw new Error('BLOCKED: KAN646_PG_URL required')
  let target: URL
  try { target = new URL(raw) } catch { throw new Error('BLOCKED: invalid KAN646_PG_URL') }
  if (!['postgres:', 'postgresql:'].includes(target.protocol) ||
    target.hostname !== '127.0.0.1' || target.port !== '55446' ||
    target.pathname !== '/kan646_biometric_disposable' ||
    target.search || target.hash || !target.username || !target.password) {
    throw new Error('BLOCKED: unauthorized KAN646 PostgreSQL target')
  }
}

export function prepareTestRunBatches(
  testFiles: string[],
  maxArgumentLength = 8_000,
): ReturnType<typeof createTestBatchInvocation>[] {
  // Node's default test concurrency launches multiple fixture files against
  // one disposable PostgreSQL database. Run that lane sequentially;
  // leave unrelated tests at their existing concurrency and batch behavior.
  const independent = testFiles.filter(path => !isSharedPostgresAcceptanceTest(path))
  const postgresShared = testFiles.filter(isSharedPostgresAcceptanceTest)
  const normal = planTestFileBatches(independent, maxArgumentLength)
    .map(createTestBatchInvocation)
  const pg = planTestFileBatches(postgresShared, maxArgumentLength)
    .map(files => {
      const invocation = createTestBatchInvocation(files)
      return {
        ...invocation,
        args: [
          ...invocation.args.slice(0, 3),
          '--test-concurrency=1',
          ...invocation.args.slice(3),
        ],
      }
    })
  return [...normal, ...pg]
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

export function renderTestBatchResults(outputs: string[]): string {
  const { diagnostics, summary } = combineTestBatchResults(outputs)

  return [
    ...diagnostics.filter((diagnostic) => diagnostic.length > 0),
    formatTestRunSummary(summary),
  ].join('\n')
}

const ANSI_GREEN = '\u001b[32m'
const ANSI_RED = '\u001b[31m'
const ANSI_RESET = '\u001b[0m'

export function extractFailedTestNames(output: string): string[] {
  const names: string[] = []

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*not ok \d+ - (.+)$/)
    if (match?.[1]) names.push(match[1].trim())
  }

  return names
}

function colorSummaryLine(line: string, color: string): string {
  return `${color}${line}${ANSI_RESET}`
}

export function renderFinalTestRunReport(outputs: string[]): string {
  const { summary } = combineTestBatchResults(outputs)
  const failedTests = [...new Set(outputs.flatMap(extractFailedTestNames))]
  const summaryLines = formatTestRunSummary(summary).split('\n').map((line) => {
    if (line.startsWith('ℹ pass ')) return colorSummaryLine(line, ANSI_GREEN)
    if (line.startsWith('ℹ fail ')) {
      return colorSummaryLine(line, summary.fail > 0 ? ANSI_RED : ANSI_GREEN)
    }
    return line
  })

  if (failedTests.length === 0) {
    return summaryLines.join('\n')
  }

  return [
    ...summaryLines,
    `${ANSI_RED}Failed tests:${ANSI_RESET}`,
    ...failedTests.map((name) => `${ANSI_RED}✖ ${name}${ANSI_RESET}`),
  ].join('\n')
}

type TestBatchInvocation = ReturnType<typeof createTestBatchInvocation>
type TestBatchSpawnResult = TestRunResult & { stdout?: string | Buffer | null; stderr?: string | Buffer | null }
type TestBatchSpawn = (
  executable: string,
  args: string[],
  options: TestBatchInvocation['options'],
) => TestBatchSpawnResult

export function executeTestRunBatches(
  invocations: TestBatchInvocation[],
  spawn: TestBatchSpawn,
  report: (output: string) => void,
): number {
  const outputs: string[] = []
  const stderrOutputs: string[] = []
  let exitCode = 0

  for (const invocation of invocations) {
    const result = spawn(process.execPath, invocation.args, invocation.options)
    const outcome = interpretTestRunResult(result)
    const stdout = typeof result.stdout === 'string'
      ? result.stdout
      : result.stdout?.toString() ?? ''
    const stderr = typeof result.stderr === 'string'
      ? result.stderr
      : result.stderr?.toString() ?? ''

    if (stdout) outputs.push(stdout)
    if (stderr) stderrOutputs.push(stderr)

    if (outcome.signal) {
      if (stdout) report(stdout)
      if (stderr) report(stderr)
      process.kill(process.pid, outcome.signal)
      return 1
    }

    if (outcome.exitCode !== 0 && exitCode === 0) {
      exitCode = outcome.exitCode ?? 1
    }
  }

  const finalReport = outputs.length > 0
    ? renderFinalTestRunReport(outputs)
    : 'Test process failed without TAP output'

  report(
    stderrOutputs.length > 0
      ? `${stderrOutputs.join('\n')}\n${finalReport}`
      : finalReport,
  )

  return exitCode
}

export function runTestFilesWith(
  testFiles: string[],
  spawn: TestBatchSpawn,
  report: (output: string) => void,
  maxArgumentLength = 8_000,
): number {
  return executeTestRunBatches(
    prepareTestRunBatches(testFiles, maxArgumentLength),
    spawn,
    report,
  )
}

export function runTestFiles(testFiles: string[]): number {
  return runTestFilesWith(
    testFiles,
    (executable, args, options) => spawnSync(executable, args, options),
    (output) => console.log(output),
  )
}

async function main(): Promise<void> {
  const pgMode = process.argv[2] === '--postgres'
  const annualMode = process.argv[2] === '--postgres-annual'
  validateTestRunnerArguments(pgMode || annualMode ? process.argv.slice(3) : process.argv.slice(2))
  const all = await discoverTestFiles(resolve(process.cwd(), 'tests'))
  const lanes = await partitionTestFiles(all)
  const annual = lanes.postgres.filter(isAnnualPostgresAcceptanceFile)
  const mutable = lanes.postgres.filter(file => !isAnnualPostgresAcceptanceFile(file))
  const selected = annualMode ? annual : pgMode ? mutable : lanes.ordinary
  if (annualMode) {
    assertSafeAnnualPostgresTarget(process.env)
    if (annual.length !== 2) throw new Error('BLOCKED: expected exactly two audited annual read-only tests')
  }
  if (pgMode) {
    assertSafePostgresRegressionTarget(process.env)
    if (selected.length === 0) throw new Error('BLOCKED: no PostgreSQL integration tests found')
  }
  console.log(`Discovered ${all.length} test files; selected ${selected.length} ${annualMode ? 'annual read-only' : pgMode ? 'disposable PostgreSQL regression' : 'ordinary'} files; PostgreSQL integration files: ${lanes.postgres.length}`)
  if (!pgMode) console.log('PostgreSQL integration NOT executed in ordinary gate: run pn test:pg and pn test:pg:annual separately (no PASS implied)')
  process.exitCode = runTestFiles(selected)
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
