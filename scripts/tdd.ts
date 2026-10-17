import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { assertSafeKan646BiometricPostgresTarget, assertSafePostgresRegressionTarget, isPostgresIntegrationSource } from './test-runner'

const require = createRequire(import.meta.url)

export function tddTypecheckCommand(): { command: string; args: string[] } {
  return {
    command: process.execPath,
    args: [require.resolve('tsx/cli'), resolve('scripts/typecheck-runner.ts')],
  }
}

type RunResult = { ok: boolean; output: string }

function run(command: string, args: string[], verbose: boolean): RunResult {
  const result = spawnSync(command, args, {
    shell: false,
    encoding: 'utf8',
    stdio: verbose ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
  })

  const output = verbose ? '' : [result.stdout, result.stderr].filter(Boolean).join('\n')
  if (verbose && result.error) process.stderr.write(`${command}: ${result.error.message}\n`)
  if (verbose && result.signal) process.stderr.write(`${command}: terminated by ${result.signal}\n`)
  return {
    ok: result.status === 0 && !result.error && !result.signal,
    output: result.error ? `${output}\n${command}: ${result.error.message}` : output,
  }
}

/** Extract the assertion and location without dumping the entire TAP report. */
export function compactTestFailure(output: string): string {
  const lines = output.split(/\r?\n/)
  const failures: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*not ok \d+/.test(line)) {
      failures.push(line.trim())
    } else if (/^\s*(error:|code:|expected:|actual:|operator:|at:)/.test(line)) {
      failures.push(line.trim())
    }
  }
  if (failures.length > 0) return failures.join('\n')
  return output.trim().split(/\r?\n/).filter(Boolean).slice(-12).join('\n') || 'Test process failed without diagnostics'
}

/** Keep one location and message per TypeScript error, without source excerpts. */
export function compactTypecheckFailure(output: string): string {
  const errors = output.split(/\r?\n/).filter((line) =>
    /^(?:.+\(\d+,\d+\): error TS\d+:|.+:\d+:\d+ - error TS\d+:|error TS\d+:)/.test(line.trim()),
  )
  if (errors.length > 0) return errors.map((line) => line.trim()).join('\n')
  return output.trim().split(/\r?\n/).filter(Boolean).slice(-12).join('\n') || 'Typecheck failed without diagnostics'
}

function main(): void {
  const args = process.argv.slice(2)
  const redOnly = args[0] === '--red'
  const remaining = redOnly ? args.slice(1) : args
  const verbose = remaining.includes('--verbose')
  const tests = remaining.filter((arg) => arg !== '--verbose')

  if (tests.length === 0) {
    process.stderr.write('Usage: pn tdd[:red] [--verbose] <test-file> [...test-files]\n')
    process.exit(2)
  }

  const sync = run('git', ['pull', '--ff-only', '-q'], verbose)
  if (!sync.ok) {
    if (!redOnly && !verbose) process.stderr.write(sync.output.trim() || 'Git sync failed')
    console.log('RED')
    process.exit(1)
  }

  // KAN-646 runs on its own disposable PG instance, never the KAN-791 lane.
  const kan646Postgres = tests.some(file =>
    /kan-646-(?:pg[0-9]+-|t5-.*postgres).*\.test\.ts$/.test(file.replaceAll('\\', '/')))
  if (kan646Postgres) assertSafeKan646BiometricPostgresTarget(process.env)
  if (tests.some(file => {
    if (/[*?\[]/.test(file)) return /postgres|pg[0-9]|kan-791/i.test(file) && !kan646Postgres
    return !/kan-646-(?:pg[0-9]+-|t5-.*postgres).*\.test\.ts$/.test(file.replaceAll('\\', '/')) &&
      isPostgresIntegrationSource(readFileSync(file, 'utf8'))
  })) {
    assertSafePostgresRegressionTarget(process.env)
  }

  const tsxCli = require.resolve('tsx/cli')
  // Shared disposable PostgreSQL fixtures can conflict at SERIALIZABLE even
  // when their IDs differ (predicate locks and unique-index reads). Run every
  // multi-file PG focused cut sequentially; do not weaken transaction isolation.
  const postgresFocused = tests.some(file => {
    if (/[*?\\[]/.test(file)) return /postgres|pg[0-9]|kan-791/i.test(file)
    return isPostgresIntegrationSource(readFileSync(file, 'utf8'))
  })
  const testOptions = postgresFocused ? ['--test-concurrency=1'] : []
  const focused = run(process.execPath, [tsxCli, '--test', ...testOptions, ...tests], verbose)

  if (redOnly) {
    console.log(focused.ok ? 'GREEN' : 'RED')
    process.exit(focused.ok ? 0 : 1)
  }

  if (!focused.ok) {
    if (!verbose) process.stderr.write(`${compactTestFailure(focused.output)}\n`)
    console.log('RED')
    process.exit(1)
  }

  const typecheck = tddTypecheckCommand()
  const checked = run(typecheck.command, typecheck.args, verbose)
  if (!checked.ok) {
    if (!verbose) process.stderr.write(`${compactTypecheckFailure(checked.output)}\n`)
    console.log('RED')
    process.exit(1)
  }

  console.log('GREEN')
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) {
  main()
}
