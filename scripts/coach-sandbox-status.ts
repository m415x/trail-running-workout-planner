import { planLocalCoachSandboxLifecycle } from '../lib/sandbox/local-lifecycle'
import { checkLocalCoachSandboxStatusWithProcess } from '../lib/sandbox/local-status-process'

type LocalStatusChecker = (request: {
  repositoryRoot: string
}) => Promise<{ available: true }>

/**
 * Explicit read-only status entrypoint for an isolated local Supabase stack.
 * This module does not run on import or accept arbitrary CLI arguments.
 * It does not start/stop Docker, migrate, seed, reset or access cloud projects.
 */
export async function runCoachSandboxStatusCommand(request: {
  repositoryRoot: string
  checkStatus?: LocalStatusChecker
}): Promise<{ available: true }> {
  // Validate before calling even an injected checker.
  planLocalCoachSandboxLifecycle({
    action: 'status',
    repositoryRoot: request.repositoryRoot,
  })

  try {
    const result = await (request.checkStatus ?? checkLocalCoachSandboxStatusWithProcess)({
      repositoryRoot: request.repositoryRoot,
    })
    if (result?.available !== true) {
      throw new Error('Unavailable')
    }
    return { available: true }
  } catch {
    // Never expose child-process stderr/stdout or URLs with credentials.
    throw new Error('Local sandbox status check failed')
  }
}
