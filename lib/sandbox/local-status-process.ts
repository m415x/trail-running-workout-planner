import { execFile as nodeExecFile } from 'node:child_process'
import { promisify } from 'node:util'

import { checkLocalCoachSandboxStatus } from './local-status'
import { resolveProjectSupabaseBinary } from './supabase-executable'

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
  resolveBinary?: (repositoryRoot: string) => string
}): Promise<{ available: true }> {
  return checkLocalCoachSandboxStatus({
    repositoryRoot: request.repositoryRoot,
    run: (command, args, { cwd }) => {
      // Tests can inject their own executor; production must resolve the
      // native project binary rather than spawning a Windows .cmd shim.
      const executable = request.resolveBinary
        ? request.resolveBinary(cwd)
        : request.execFile
          ? command
          : resolveProjectSupabaseBinary({ repositoryRoot: cwd, platform: process.platform })

      return (request.execFile ?? defaultExecFile)(
        executable,
        args,
        {
        cwd,
        shell: false,
        timeout: 15000,
        maxBuffer: 65536,
        windowsHide: true,
        },
      )
    },
  })
}
