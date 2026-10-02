import { isAbsolute, win32 } from 'node:path'

type LocalSandboxLifecycleInput = {
  action: string
  repositoryRoot: string
}

type LocalSandboxLifecyclePlan = {
  command: 'supabase'
  args: readonly string[]
  cwd: string
}

/**
 * Pure command plan: no CLI invocation, environment mutation or Docker access.
 * Only the read-only local status operation is permitted in this stage.
 */
export function planLocalCoachSandboxLifecycle(
  request: LocalSandboxLifecycleInput,
): LocalSandboxLifecyclePlan {
  if (request.action !== 'status') {
    throw new Error('Unsupported local sandbox lifecycle operation')
  }

  const root = request.repositoryRoot

  if (
    typeof root !== 'string'
    || root.trim() !== root
    || root.length === 0
    || root.includes('\n')
    || root.includes('\r')
    || root.includes('\0')
    || !(isAbsolute(root) || win32.isAbsolute(root))
  ) {
    throw new Error('An unambiguous absolute sandbox repository root is required')
  }

  return {
    command: 'supabase',
    args: ['status', '--workdir', root],
    cwd: root,
  }
}
