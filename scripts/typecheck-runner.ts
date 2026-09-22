import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)

export type TypecheckStep = {
  command: 'next' | 'tsc'
  args: string[]
}

type StepResult = Pick<SpawnSyncReturns<Buffer>, 'status' | 'signal' | 'error'>
type StepRunner = (command: string, args: string[]) => StepResult

export function typecheckSteps(): TypecheckStep[] {
  return [
    { command: 'next', args: ['typegen'] },
    { command: 'tsc', args: ['--noEmit'] },
  ]
}

function resolveCommand(command: TypecheckStep['command']): string {
  if (command === 'next') return require.resolve('next/dist/bin/next')
  return require.resolve('typescript/bin/tsc')
}

export function runTypecheckSteps(
  steps = typecheckSteps(),
  run: StepRunner = (command, args) =>
    spawnSync(process.execPath, [resolveCommand(command as TypecheckStep['command']), ...args], {
      shell: false,
      stdio: 'inherit',
    }),
): number {
  for (const step of steps) {
    const result = run(step.command, step.args)

    if (result.error) throw result.error
    if (result.signal) {
      process.kill(process.pid, result.signal)
      return 1
    }
    if (result.status !== 0) return result.status ?? 1
  }

  return 0
}

function main(): void {
  process.exitCode = runTypecheckSteps()
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) {
  main()
}
