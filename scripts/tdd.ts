import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const redOnly = args[0] === '--red'
const remaining = redOnly ? args.slice(1) : args
const verboseIndex = remaining.indexOf('--verbose')
const verbose = verboseIndex >= 0
const tests = remaining.filter((arg, index) => index !== verboseIndex)

if (tests.length === 0) {
  process.stderr.write('Usage: pn tdd[:red] [--verbose] <test-file> [...test-files]\n')
  process.exit(2)
}

function run(command: string, commandArgs: string[]): boolean {
  const executable = process.platform === 'win32' && command === 'pn' ? 'pn.cmd' : command
  const result = spawnSync(executable, commandArgs, {
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

const testsGreen = run('pn', ['exec', 'tsx', '--test', ...tests])

if (redOnly) {
  console.log(testsGreen ? 'GREEN' : 'RED')
  process.exit(testsGreen ? 0 : 1)
}

if (!testsGreen || !run('pn', ['tsc'])) {
  console.log('RED')
  process.exit(1)
}

console.log('GREEN')
