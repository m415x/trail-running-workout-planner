import { planLocalCoachSandboxLifecycle } from './local-lifecycle'

type LocalStatusProcessResult = {
  exitCode: number
  stderr?: string
}

type LocalStatusRunner = (
  command: string,
  args: readonly string[],
  options: { cwd: string },
) => Promise<LocalStatusProcessResult>

/**
 * A narrowly scoped read-only status runner. The caller explicitly supplies
 * the process executor; importing this file launches no subprocesses.
 * Failures never expose CLI stdout/stderr, DSNs, or driver diagnostics.
 */
export async function checkLocalCoachSandboxStatus(request: {
  repositoryRoot: string
  run: LocalStatusRunner
}): Promise<{ available: true }> {
  const plan = planLocalCoachSandboxLifecycle({
    action: 'status',
    repositoryRoot: request.repositoryRoot,
  })

  let result: LocalStatusProcessResult
  try {
    result = await request.run(plan.command, plan.args, { cwd: plan.cwd })
  } catch {
    throw new Error('Local sandbox status check failed')
  }

  if (!result || result.exitCode !== 0) {
    throw new Error('Local sandbox status check failed')
  }

  return { available: true }
}
