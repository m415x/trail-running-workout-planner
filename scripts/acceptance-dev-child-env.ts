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

export interface AcceptanceDevWindowsTreeTerminationInput {
  childPid: number
  launcherPid: number
}

export interface AcceptanceDevWindowsTreeTerminationPlan {
  command: string
  args: string[]
  shell: false
}

/**
 * KAN-885/L6: pure Windows process-tree termination command specification.
 * The caller must obtain childPid from a child it spawned and still owns.
 * This function neither establishes ownership nor executes taskkill; PID
 * reuse and child exit races require checks at the real lifecycle boundary.
 */
export function buildAcceptanceDevWindowsTreeTerminationPlan(
  input: AcceptanceDevWindowsTreeTerminationInput,
): AcceptanceDevWindowsTreeTerminationPlan {
  const { childPid, launcherPid } = input
  if (
    !Number.isSafeInteger(childPid)
    || childPid <= 0
    || !Number.isSafeInteger(launcherPid)
    || launcherPid <= 0
    || childPid === launcherPid
  ) {
    throw new Error('KAN-885: invalid child or launcher PID for termination')
  }

  return {
    command: 'taskkill.exe',
    args: ['/PID', String(childPid), '/T', '/F'],
    shell: false,
  }
}

export interface AcceptanceDevOwnedChildTerminationInput {
  child: EventEmitter & { pid?: number }
  launcherPid: number
}

export interface AcceptanceDevOwnedChildTerminationGuard {
  planTermination(): AcceptanceDevWindowsTreeTerminationPlan
  dispose(): void
}

/**
 * KAN-885/L6: bind termination planning to one live child handle, not to a
 * caller-supplied PID on each request. The caller must pass the actual
 * ChildProcess returned by its own spawn; an EventEmitter alone does not prove
 * OS-level ownership. Do not execute taskkill from this boundary.
 */
export function createAcceptanceDevOwnedChildTerminationGuard(
  input: AcceptanceDevOwnedChildTerminationInput,
): AcceptanceDevOwnedChildTerminationGuard {
  const { child, launcherPid } = input
  const childPid = child.pid
  // Reject invalid/missing PIDs before installing handlers.
  const plan = buildAcceptanceDevWindowsTreeTerminationPlan({
    childPid: childPid ?? 0,
    launcherPid,
  })
  let active = true

  const dispose = () => {
    if (!active) {
      return
    }
    active = false
    child.off('close', dispose)
  }
  child.once('close', dispose)

  return {
    planTermination() {
      if (!active) {
        throw new Error('KAN-885: owned child is closed or disposed')
      }
      return { command: plan.command, args: [...plan.args], shell: false }
    },
    dispose,
  }
}

export interface AcceptanceDevManagedChildInput {
  plan: AcceptanceDevNextLaunchPlan
  signalSource: EventEmitter
  spawnChild: (plan: AcceptanceDevNextLaunchPlan) => EventEmitter & { pid?: number }
  terminateTree: (plan: AcceptanceDevWindowsTreeTerminationPlan) => Promise<void>
  launcherPid: number
  terminationTimeoutMs?: number
}

/**
 * KAN-885/L6: compose owned-child planning, signal delivery, and completion.
 * Dependencies are injected to test state transitions without OS termination.
 * Production integration must use the actual ChildProcess returned from spawn;
 * this helper is NOT wired to the CLI or a real taskkill invocation yet.
 */
export function runAcceptanceDevManagedChild(input: AcceptanceDevManagedChildInput): Promise<number> {
  const terminationTimeoutMs = input.terminationTimeoutMs ?? 5000
  if (!Number.isSafeInteger(terminationTimeoutMs) || terminationTimeoutMs < 1 || terminationTimeoutMs > 60000) {
    return Promise.reject(new Error('KAN-885: invalid managed child termination timeout'))
  }

  return new Promise<number>((resolveExit, rejectExit) => {
    let child: ReturnType<AcceptanceDevManagedChildInput['spawnChild']>
    try {
      child = input.spawnChild(input.plan)
    } catch {
      rejectExit(new Error('KAN-885: unable to start managed child'))
      return
    }

    let guard: AcceptanceDevOwnedChildTerminationGuard
    try {
      guard = createAcceptanceDevOwnedChildTerminationGuard({
        child,
        launcherPid: input.launcherPid,
      })
    } catch {
      // Node may return a ChildProcess without a PID before emitting its
      // asynchronous spawn 'error' (e.g. ENOENT). Consume that event to avoid
      // an unhandled EventEmitter error after the caller receives rejection.
      child.once('error', () => {})
      rejectExit(new Error('KAN-885: invalid managed child PID'))
      return
    }

    let finished = false
    let terminating = false
    let terminationTimer: ReturnType<typeof setTimeout> | undefined
    const cleanup = () => {
      if (terminationTimer !== undefined) {
        clearTimeout(terminationTimer)
        terminationTimer = undefined
      }
      input.signalSource.off('SIGINT', onSigint)
      input.signalSource.off('SIGTERM', onSigterm)
      child.off('close', onClose)
      child.off('error', onError)
      guard.dispose()
    }
    const finish = (error: Error | null, code?: number) => {
      if (finished) return
      finished = true
      cleanup()
      if (error) rejectExit(error)
      else resolveExit(code ?? 0)
    }
    const onClose = (code: number | null, signal: string | null) => {
      // A cancellation is a terminal failure regardless of the child's exit
      // code: even close(0) must never override SIGINT/SIGTERM or its tree-kill
      // request. This also prevents a pending failed termination from being
      // misreported as a clean launcher exit.
      if (terminating) {
        finish(new Error('KAN-885: managed child terminated after interruption signal'))
      } else if (code !== null) {
        finish(null, code)
      } else {
        finish(new Error(signal
          ? 'KAN-885: managed child terminated by signal'
          : 'KAN-885: managed child closed without exit status'))
      }
    }
    const onError = () => finish(new Error('KAN-885: managed child process failed'))
    const onSignal = () => {
      if (finished || terminating) return
      terminating = true
      terminationTimer = setTimeout(() => {
        finish(new Error('KAN-885: managed child close timed out after termination'))
      }, terminationTimeoutMs)
      let terminationPlan: AcceptanceDevWindowsTreeTerminationPlan
      try {
        terminationPlan = guard.planTermination()
      } catch {
        finish(new Error('KAN-885: managed child is no longer available'))
        return
      }
      try {
        void Promise.resolve(input.terminateTree(terminationPlan)).catch(() => {
          finish(new Error('KAN-885: managed child tree termination failed'))
        })
      } catch {
        finish(new Error('KAN-885: managed child tree termination failed'))
      }
    }
    const onSigint = () => onSignal()
    const onSigterm = () => onSignal()

    child.once('close', onClose)
    child.once('error', onError)
    input.signalSource.on('SIGINT', onSigint)
    input.signalSource.on('SIGTERM', onSigterm)
  })
}

export interface AcceptanceDevWindowsTerminationProcess extends EventEmitter {
  kill?: (signal?: NodeJS.Signals) => boolean
}

export interface AcceptanceDevWindowsTreeExecutionInput {
  plan: AcceptanceDevWindowsTreeTerminationPlan
  terminationTimeoutMs?: number
  spawnTermination: (
    command: string,
    args: string[],
    options: { shell: false; stdio: 'ignore'; windowsHide: true },
  ) => AcceptanceDevWindowsTerminationProcess
}

/**
 * KAN-885/L6: execute an already-approved Windows tree-kill plan via an
 * injected process boundary. Do not accept arbitrary commands or shell text.
 * Success means taskkill exited zero, not that all descendants were
 * independently verified absent. The caller must establish owned PID provenance.
 */
export function executeAcceptanceDevWindowsTreeTermination(
  input: AcceptanceDevWindowsTreeExecutionInput,
): Promise<void> {
  const { plan, spawnTermination } = input
  const terminationTimeoutMs = input.terminationTimeoutMs ?? 5000
  if (!Number.isSafeInteger(terminationTimeoutMs) || terminationTimeoutMs < 1 || terminationTimeoutMs > 60000) {
    return Promise.reject(new Error('KAN-885: invalid Windows tree termination timeout'))
  }
  const args = plan?.args
  const pidText = Array.isArray(args) && args.length === 4 ? args[1] : undefined
  const pid = typeof pidText === 'string' && /^[1-9][0-9]*$/.test(pidText)
    ? Number(pidText)
    : Number.NaN

  if (
    plan?.command !== 'taskkill.exe'
    || plan.shell !== false
    || !Array.isArray(args)
    || args.length !== 4
    || args[0] !== '/PID'
    || args[2] !== '/T'
    || args[3] !== '/F'
    || !Number.isSafeInteger(pid)
    || pid <= 0
  ) {
    return Promise.reject(new Error('KAN-885: invalid Windows tree termination plan'))
  }

  return new Promise<void>((resolveDone, rejectDone) => {
    let termination: AcceptanceDevWindowsTerminationProcess
    try {
      termination = spawnTermination('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
        shell: false,
        stdio: 'ignore',
        windowsHide: true,
      })
    } catch {
      rejectDone(new Error('KAN-885: unable to start Windows tree termination'))
      return
    }

    let settled = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    const cleanup = () => {
      if (timeout !== undefined) {
        clearTimeout(timeout)
        timeout = undefined
      }
      termination.off('close', onClose)
      termination.off('error', onError)
    }
    const finish = (error: string | null) => {
      if (settled) return
      settled = true
      cleanup()
      if (error) rejectDone(new Error(error))
      else resolveDone()
    }
    const onClose = (code: number | null) => finish(code === 0
      ? null
      : 'KAN-885: Windows tree termination failed')
    const onError = () => finish('KAN-885: Windows tree termination failed')
    termination.once('close', onClose)
    termination.once('error', onError)
    timeout = setTimeout(() => {
      finish('KAN-885: Windows tree termination helper timed out')
      // Only target the helper handle returned by spawnTermination, never
      // the child PID in the taskkill arguments. A timeout is not proof that
      // either OS process has terminated.
      try {
        termination.kill?.('SIGTERM')
      } catch {
        // The failure is already reported; do not expose system diagnostics.
      }
    }, terminationTimeoutMs)
  })
}

export interface AcceptanceDevWindowsManagedSpawnOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  shell: false
  stdio: 'ignore'
  windowsHide: true
}

export interface AcceptanceDevWindowsManagedChildInput {
  plan: AcceptanceDevNextLaunchPlan
  signalSource: EventEmitter
  launcherPid: number
  spawnProcess: (
    command: string,
    args: string[],
    options: AcceptanceDevWindowsManagedSpawnOptions,
  ) => EventEmitter & { pid?: number }
  terminationTimeoutMs?: number
}

/**
 * KAN-885/L6: compose the managed child lifecycle with the Windows taskkill
 * executor using one explicit process-spawn boundary. The child handle/PID is
 * obtained from the launch call, never from a separate termination argument.
 *
 * This boundary remains dependency-injected and is not wired to the CLI.
 * Real Windows/Git Bash process-tree and port-release acceptance is pending.
 */
export function runAcceptanceDevWindowsManagedChild(
  input: AcceptanceDevWindowsManagedChildInput,
): Promise<number> {
  return runAcceptanceDevManagedChild({
    plan: input.plan,
    signalSource: input.signalSource,
    launcherPid: input.launcherPid,
    terminationTimeoutMs: input.terminationTimeoutMs,
    spawnChild: plan => input.spawnProcess(plan.command, plan.args, {
      cwd: plan.cwd,
      env: plan.env,
      shell: false,
      stdio: 'ignore',
      windowsHide: true,
    }),
    terminateTree: plan => executeAcceptanceDevWindowsTreeTermination({
      plan,
      spawnTermination: (command, args, options) =>
        input.spawnProcess(command, args, options),
    }),
  })
}

export interface AcceptanceDevWindowsOwnedProcessInput {
  plan: AcceptanceDevNextLaunchPlan
  signalSource: EventEmitter
  terminationTimeoutMs?: number
}

/**
 * KAN-885/L6: the real Node spawn adapter for the managed Windows lifecycle.
 * The caller must complete accreditation before passing a Next launch plan.
 * This does not start anything unless explicitly invoked.
 */
export function runAcceptanceDevWindowsOwnedProcess(
  input: AcceptanceDevWindowsOwnedProcessInput,
): Promise<number> {
  return runAcceptanceDevWindowsManagedChild({
    plan: input.plan,
    signalSource: input.signalSource,
    launcherPid: process.pid,
    spawnProcess: (command, args, options) => spawn(command, args, options),
    terminationTimeoutMs: input.terminationTimeoutMs,
  })
}

export interface AcceptanceDevWindowsTerminalProcessInput {
  plan: AcceptanceDevNextLaunchPlan
  terminationTimeoutMs?: number
}

/**
 * KAN-885/L6: connect the real launcher process signals to the owned child
 * lifecycle. The managed runner installs and removes SIGINT/SIGTERM listeners
 * for the duration of this run. Not yet integrated with the acceptance CLI;
 * interactive Ctrl+C from Git Bash still requires separate accreditation.
 */
export function runAcceptanceDevWindowsTerminalProcess(
  input: AcceptanceDevWindowsTerminalProcessInput,
): Promise<number> {
  return runAcceptanceDevWindowsOwnedProcess({
    plan: input.plan,
    signalSource: process,
    terminationTimeoutMs: input.terminationTimeoutMs,
  })
}
