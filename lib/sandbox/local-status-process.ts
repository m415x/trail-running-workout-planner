import { execFile as nodeExecFile } from 'node:child_process'
import { promisify } from 'node:util'

import { checkLocalCoachSandboxStatus } from './local-status'

const execFileAsync = promisify(nodeExecFile)

type BoundedProcessOptions = {
  cwd: string
  shell: false
  timeout: 15000
  maxBuffer: 65536
  windowsHide: true
}

type StatusProcessResult = { exitCode: number }

type StatusProcessExecutor = (
  command: string,
  args: readonly string[],
  options: BoundedProcessOptions,
) => Promise<StatusProcessResult>

/**
 * No shell or user-supplied arguments: execute exactly the local status plan.
 * The injected executor permits testing without starting Supabase/Docker.
 * stdout/stderr never enter the returned result or error messages.
 */
const defaultExecFile: StatusProcessExecutor = async (command, args, options) => {
  await execFileAsync(command, [...args], options)
  return { exitCode: 0 }
}

export async function checkLocalCoachSandboxStatusWithProcess(request: {
  repositoryRoot: string
  execFile?: StatusProcessExecutor
}): Promise<{ available: true }> {
  return checkLocalCoachSandboxStatus({
    repositoryRoot: request.repositoryRoot,
    run: (command, args, { cwd }) => (request.execFile ?? defaultExecFile)(
      command,
      args,
      {
        cwd,
        shell: false,
        timeout: 15000,
        maxBuffer: 65536,
        windowsHide: true,
      },
    ),
  })
}
