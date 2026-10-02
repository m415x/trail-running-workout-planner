import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { planLocalCoachSandboxLifecycle } from '../lib/sandbox/local-lifecycle'
import { runCoachSandboxStatusCommand } from './coach-sandbox-status'

type StatusChecker = (request: {
  repositoryRoot: string
}) => Promise<{ available: true }>

/**
 * Read-only local status CLI. Reject user arguments rather than forwarding
 * them to Supabase; importing this module never executes any command.
 */
export async function runCoachSandboxStatusCli(request: {
  args: readonly string[]
  repositoryRoot: string
  checkStatus?: StatusChecker
}): Promise<{ available: true }> {
  if (request.args.length !== 0) {
    throw new Error('Coach sandbox status command does not accept arguments')
  }

  planLocalCoachSandboxLifecycle({
    action: 'status',
    repositoryRoot: request.repositoryRoot,
  })

  try {
    return await runCoachSandboxStatusCommand({
      repositoryRoot: request.repositoryRoot,
      checkStatus: request.checkStatus,
    })
  } catch {
    throw new Error('Local sandbox status check failed')
  }
}

async function main(): Promise<void> {
  try {
    await runCoachSandboxStatusCli({
      args: process.argv.slice(2),
      repositoryRoot: process.cwd(),
    })
    process.stdout.write('Local sandbox status: available\n')
  } catch {
    process.stderr.write('Local sandbox status check failed\n')
    process.exitCode = 1
  }
}

// Keep test imports inert: only run when explicitly invoked as the CLI file.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main()
}
