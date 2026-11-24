import { resolve } from 'node:path'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'

export interface AcceptanceDevChildEnvInput {
  inheritedEnv: Readonly<Record<string, string | undefined>>
  databasePath: string
  projectRoot: string
}

/**
 * KAN-885/T3: minimal, explicit Next child-process environment.
 *
 * Do not spread the parent environment. Sensitive auth material and SQLite
 * provisioning acknowledgments must never be implicitly inherited.
 * This constructs data only: it does not start a child process or access SQLite.
 */
export function buildAcceptanceDevChildEnv(input: AcceptanceDevChildEnvInput): NodeJS.ProcessEnv {
  if (!input.databasePath?.trim()) {
    throw new Error('KAN-885: accredited SQLite database path is missing')
  }
  if (!input.projectRoot?.trim()) {
    throw new Error('KAN-885: project root path is missing')
  }

  // Required cross-platform process/runtime plumbing only. Authentication
  // configuration will need a separate reviewed contract and explicit inputs.
  const allowed = [
    'PATH',
    'Path',
    'HOME',
    'USERPROFILE',
    'HOMEDRIVE',
    'HOMEPATH',
    'SYSTEMROOT',
    'SystemRoot',
    'WINDIR',
    'TEMP',
    'TMP',
    'TMPDIR',
    'COMSPEC',
    'PATHEXT',
    'APPDATA',
    'LOCALAPPDATA',
    'LANG',
    'LC_ALL',
    'TERM',
  ] as const

  // Next 16 augments ProcessEnv with a required, readonly NODE_ENV.
  // A development-only launcher must set it explicitly, not inherit production.
  const child: NodeJS.ProcessEnv = { NODE_ENV: 'development' }
  for (const name of allowed) {
    const value = input.inheritedEnv[name]
    if (value !== undefined) {
      child[name] = value
    }
  }

  child.SQLITE_DATABASE_PATH = input.databasePath
  child.SQLITE_SCENARIO_MODE = '1'
  child.EPT_IDENTITY_BACKEND = 'sqlite'
  child.TSX_TSCONFIG_PATH = resolve(input.projectRoot, 'tsconfig.json')
  return child
}

export interface AcceptanceDevNextLaunchPlanInput extends AcceptanceDevChildEnvInput {
  port?: number
}

export interface AcceptanceDevNextLaunchPlan {
  command: string
  args: string[]
  cwd: string
  env: NodeJS.ProcessEnv
}

/**
 * Pure Next.js launch plan for the current checkout, restricted to loopback.
 * Caller must complete accredited SQLite and legitimate H2/H1 preflight before
 * using this plan to spawn a process. No ports are inspected or bound here.
 */
export function buildAcceptanceDevNextLaunchPlan(
  input: AcceptanceDevNextLaunchPlanInput,
): AcceptanceDevNextLaunchPlan {
  const port = input.port ?? 3000
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('KAN-885: invalid Next.js dev port; expected integer 1024–65535')
  }

  const env = buildAcceptanceDevChildEnv(input)
  const cwd = resolve(input.projectRoot)
  return {
    command: process.execPath,
    args: [
      resolve(cwd, 'node_modules/next/dist/bin/next'),
      'dev',
      '--hostname',
      '127.0.0.1',
      '--port',
      String(port),
    ],
    cwd,
    env,
  }
}

/**
 * KAN-885/L5: non-destructively probe whether loopback can bind the port.
 *
 * A successful probe releases only its own listener. This is not a lock:
 * Next.js must still handle EADDRINUSE if another process binds afterward.
 */
export async function assertAcceptanceDevPortAvailable(port: number): Promise<void> {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('KAN-885: invalid Next.js dev port')
  }

  const server = createServer()
  await new Promise<void>((resolveProbe, rejectProbe) => {
    const onError = (error: NodeJS.ErrnoException) => {
      server.off('listening', onListening)
      if (error.code === 'EADDRINUSE') {
        rejectProbe(new Error('KAN-885: loopback port is occupied (EADDRINUSE)'))
      } else {
        rejectProbe(new Error('KAN-885: loopback port availability check failed'))
      }
    }
    const onListening = () => {
      server.off('error', onError)
      server.close(error => {
        if (error) {
          rejectProbe(new Error('KAN-885: port probe cleanup failed'))
        } else {
          resolveProbe()
        }
      })
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, '127.0.0.1')
  })
}

/**
 * KAN-885/L12: run an explicitly supplied child process and preserve its exit
 * status. Do not use a shell, echo its command/env, or start Next from the CLI.
 *
 * This primitive does NOT yet implement signal forwarding / process-tree cleanup
 * (L6), startup readiness or H2 authentication. Do not wire it to the launcher
 * until those requirements are fulfilled.
 */
export function runAcceptanceDevChild(plan: AcceptanceDevNextLaunchPlan): Promise<number> {
  return new Promise<number>((resolveExit, rejectExit) => {
    const child = spawn(plan.command, plan.args, {
      cwd: plan.cwd,
      env: plan.env,
      shell: false,
      stdio: 'ignore',
      windowsHide: true,
    })

    child.once('error', () => {
      rejectExit(new Error('KAN-885: unable to start child process'))
    })
    child.once('close', (code, signal) => {
      if (code !== null) {
        resolveExit(code)
      } else {
        rejectExit(new Error(signal
          ? 'KAN-885: child process terminated by signal'
          : 'KAN-885: child process closed without exit status'))
      }
    })
  })
}

type AcceptanceDevTerminationSignal = 'SIGINT' | 'SIGTERM'

export interface AcceptanceDevSignalForwardingInput {
  signalSource: EventEmitter
  child: EventEmitter & { kill(signal: AcceptanceDevTerminationSignal): boolean }
}

/**
 * KAN-885/L6 (handler contract only): forward the first termination signal to
 * this specific child and detach listeners when it exits or during cleanup.
 *
 * It does not establish process-tree cleanup on Windows/Git Bash. Do not wire
 * into the launcher until descendant termination is separately accredited.
 */
export function registerAcceptanceDevSignalForwarding(
  input: AcceptanceDevSignalForwardingInput,
): () => void {
  const { signalSource, child } = input
  let forwarded = false
  let disposed = false

  const onSignal = (signal: AcceptanceDevTerminationSignal) => {
    if (disposed || forwarded) {
      return
    }
    forwarded = true
    child.kill(signal)
  }
  const onSigint = () => onSignal('SIGINT')
  const onSigterm = () => onSignal('SIGTERM')
  const cleanup = () => {
    if (disposed) {
      return
    }
    disposed = true
    signalSource.off('SIGINT', onSigint)
    signalSource.off('SIGTERM', onSigterm)
    child.off('close', cleanup)
  }

  signalSource.on('SIGINT', onSigint)
  signalSource.on('SIGTERM', onSigterm)
  child.once('close', cleanup)
  return cleanup
}
