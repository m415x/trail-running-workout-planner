import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)

export function tddTypecheckCommand(): { command: string; args: string[] } {
  return { command: process.execPath, args: [resolve('scripts/typecheck-runner.ts')] }
}

function main(): void {
  const args = process.argv.slice(2)
  const redOnly = args[0] === '--red'
  const remaining = redOnly ? args.slice(1) : args
  const verboseIndex = remaining.indexOf('--verbose')
  const verbose = verboseIndex >= 0
  const tests = remaining.filter((_, index) => index !== verboseIndex)
  
  if (tests.length === 0) {
    process.stderr.write('Usage: pn tdd[:red] [--verbose] <test-file> [...test-files]\n')
    process.exit(2)
  }
  
  function run(command: string, commandArgs: string[]): boolean {
    const result = spawnSync(command, commandArgs, {
      shell: false,
      stdio: verbose ? 'inherit' : 'ignore',
    })
  
    if (verbose && result.error) process.stderr.write(`${command}: ${result.error.message}\n`)
    if (verbose && result.signal) process.stderr.write(`${command}: terminated by ${result.signal}\n`)
    if (verbose && result.status !== 0 && !result.error) process.stderr.write(`${command}: exit ${result.status}\n`)
  
    return result.status === 0
  }
  
  if (!run('git', ['pull', '--ff-only', '-q'])) {
    console.log('RED')
    process.exit(1)
  }
  
  const tsxCli = require.resolve('tsx/cli')
  const testsGreen = run(process.execPath, [tsxCli, '--test', ...tests])
  
  if (redOnly) {
    console.log(testsGreen ? 'GREEN' : 'RED')
    process.exit(testsGreen ? 0 : 1)
  }
  
  const typecheck = tddTypecheckCommand()
  if (!testsGreen || !run(typecheck.command, typecheck.args)) {
    console.log('RED')
    process.exit(1)
  }
  
  console.log('GREEN')
  
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) {
  main()
}
