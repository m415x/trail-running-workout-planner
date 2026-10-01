import { spawnSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  formatVerificationSummary,
  parseVerifyOptions,
  runVerification,
  verificationStages,
  type StageExecution,
  type VerificationStage,
} from './verify'

export interface VerifyCliDependencies {
  execute: (stage: VerificationStage, verbose: boolean) => Promise<StageExecution> | StageExecution
  write: (text: string) => void
}

export async function runVerifyCli(
  args: string[],
  dependencies: VerifyCliDependencies,
): Promise<number> {
  let options

  try {
    options = parseVerifyOptions(args)
  } catch (error) {
    dependencies.write(`${error instanceof Error ? error.message : String(error)}\n`)
    dependencies.write('Usage: pn verify [--db] [-v|--verbose]\n')
    return 2
  }

  const stages = verificationStages(options.db)
  let current = 0
  const report = await runVerification(stages, async (stage) => {
    current += 1
    dependencies.write(`[${current}/${stages.length}] ${stage.label}\n`)
    return dependencies.execute(stage, options.verbose)
  })

  dependencies.write(`\n${formatVerificationSummary(report)}\n`)
  return report.success ? 0 : 1
}

export function executeVerifyStage(stage: VerificationStage, verbose: boolean): StageExecution {
  const started = performance.now()
  const pnpmPath = process.env.npm_execpath
  const command = pnpmPath ? process.execPath : process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const args = pnpmPath ? [pnpmPath, 'run', stage.command] : ['run', stage.command]
  const result = spawnSync(command, args, {
    shell: !pnpmPath && process.platform === 'win32',
    encoding: 'utf8',
    stdio: verbose ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  })
  const output = verbose
    ? ''
    : [result.stdout, result.stderr].filter(Boolean).join('\n')
  const diagnostic = result.error
    ? `\n${result.error.message}`
    : result.signal
      ? `\nProcess terminated by ${result.signal}`
      : ''

  return {
    exitCode: result.status === 0 && !result.error && !result.signal
      ? 0
      : (result.status ?? 1) || 1,
    output: output + diagnostic,
    durationMs: Math.round(performance.now() - started),
  }
}

const entryPoint = process.argv[1]

if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) {
  runVerifyCli(process.argv.slice(2), {
    execute: executeVerifyStage,
    write: (text) => process.stdout.write(text),
  }).then(
    (exitCode) => { process.exitCode = exitCode },
    (error: unknown) => {
      process.stderr.write(`Verification runner failed: ${String(error)}\n`)
      process.exitCode = 1
    },
  )
}
