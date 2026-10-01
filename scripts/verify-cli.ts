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

type VerifySpawnResult = {
  status: number | null
  stdout?: string | Buffer | null
  stderr?: string | Buffer | null
  signal?: NodeJS.Signals | null
  error?: Error
}

type VerifySpawnOptions = {
  shell: boolean
  encoding: 'utf8'
  stdio: 'inherit' | ['ignore', 'pipe', 'pipe']
  maxBuffer: number
}

export interface VerifyProcessRuntime {
  npmExecPath: string | undefined
  nodeExecPath: string
  platform: NodeJS.Platform
  spawn: (command: string, args: string[], options: VerifySpawnOptions) => VerifySpawnResult
}

export function executeVerifyStage(
  stage: VerificationStage,
  verbose: boolean,
  runtime: VerifyProcessRuntime = {
    npmExecPath: process.env.npm_execpath,
    nodeExecPath: process.execPath,
    platform: process.platform,
    spawn: (command, args, options) => spawnSync(command, args, options),
  },
): StageExecution {
  const started = performance.now()
  const pnpmPath = runtime.npmExecPath
  const javaScriptLauncher = pnpmPath != null && /\.(?:cjs|mjs|js)$/i.test(pnpmPath)
  const nativeLauncher = pnpmPath != null && /\.exe$/i.test(pnpmPath)

  if (pnpmPath && !javaScriptLauncher && !nativeLauncher) {
    return {
      exitCode: 1,
      output: `Unsupported package manager launcher extension: ${pnpmPath}`,
      durationMs: Math.round(performance.now() - started),
    }
  }

  const command = javaScriptLauncher
    ? runtime.nodeExecPath
    : pnpmPath ?? (runtime.platform === 'win32' ? 'pnpm.cmd' : 'pnpm')
  const args = javaScriptLauncher
    ? [pnpmPath!, 'run', stage.command]
    : ['run', stage.command]
  const result = runtime.spawn(command, args, {
    shell: !pnpmPath && runtime.platform === 'win32',
    encoding: 'utf8',
    stdio: verbose ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  })
  const stdout = typeof result.stdout === 'string' ? result.stdout : result.stdout?.toString() ?? ''
  const stderr = typeof result.stderr === 'string' ? result.stderr : result.stderr?.toString() ?? ''
  const output = verbose ? '' : [stdout, stderr].filter(Boolean).join('\n')
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
