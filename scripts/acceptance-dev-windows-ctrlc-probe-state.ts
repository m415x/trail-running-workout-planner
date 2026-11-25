import { open } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'

/**
 * KAN-885/T3 L6: validate the untrusted serialized record of a standalone
 * disposable Ctrl+C probe. No filesystem, network or process operations.
 *
 * A well-formed record is not proof of PID ownership or current liveness.
 * The separate --verify boundary must establish that before any OS action.
 */
export interface AcceptanceDevCtrlcProbeState {
  version: 1
  parentPid: number
  childPid: number
  port: number
  nonce: string
}

export function parseAcceptanceDevCtrlcProbeState(raw: string): AcceptanceDevCtrlcProbeState {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('KAN-885: invalid Ctrl+C diagnostic record')
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('KAN-885: invalid Ctrl+C diagnostic record')
  }

  const record = parsed as Record<string, unknown>
  const keys = Object.keys(record)
  const required = ['version', 'parentPid', 'childPid', 'port', 'nonce']
  if (keys.length !== required.length || !required.every(key => Object.hasOwn(record, key))) {
    throw new Error('KAN-885: invalid Ctrl+C diagnostic record fields')
  }

  const { version, parentPid, childPid, port, nonce } = record
  if (
    version !== 1
    || !Number.isSafeInteger(parentPid) || (parentPid as number) <= 0
    || !Number.isSafeInteger(childPid) || (childPid as number) <= 0
    || parentPid === childPid
    || !Number.isSafeInteger(port) || (port as number) < 1 || (port as number) > 65535
    || typeof nonce !== 'string' || !/^[a-f0-9]{32}$/.test(nonce)
  ) {
    throw new Error('KAN-885: invalid Ctrl+C diagnostic record values')
  }

  return {
    version: 1,
    parentPid: parentPid as number,
    childPid: childPid as number,
    port: port as number,
    nonce: nonce as string,
  }
}

export interface AcceptanceDevCtrlcProbeVerificationInput {
  raw: string
  expectedNonce: string
  isPidAlive: (pid: number) => boolean | Promise<boolean>
  isPortAvailable: (port: number) => boolean | Promise<boolean>
}

/**
 * KAN-885/T3 L6: read-only post-interruption verification. Match the run
 * nonce before any injected OS inspection. No process termination or writes.
 *
 * A matching nonce and absent PIDs still require trusted provenance of the
 * record and independent Windows acceptance before claiming real Ctrl+C.
 */
export async function verifyAcceptanceDevCtrlcProbeState(
  input: AcceptanceDevCtrlcProbeVerificationInput,
): Promise<void> {
  const state = parseAcceptanceDevCtrlcProbeState(input.raw)
  if (
    typeof input.expectedNonce !== 'string'
    || !/^[a-f0-9]{32}$/.test(input.expectedNonce)
    || state.nonce !== input.expectedNonce
  ) {
    throw new Error('KAN-885: Ctrl+C diagnostic run nonce mismatch')
  }

  try {
    const parentAlive = await input.isPidAlive(state.parentPid)
    if (typeof parentAlive !== 'boolean' || parentAlive) {
      throw new Error('KAN-885: Ctrl+C diagnostic parent process is not confirmed absent')
    }
    const childAlive = await input.isPidAlive(state.childPid)
    if (typeof childAlive !== 'boolean' || childAlive) {
      throw new Error('KAN-885: Ctrl+C diagnostic descendant process is not confirmed absent')
    }
    const available = await input.isPortAvailable(state.port)
    if (available !== true) {
      throw new Error('KAN-885: Ctrl+C diagnostic loopback port is not confirmed released')
    }
  } catch {
    // Never expose OS/probe exception details, including user file paths.
    throw new Error('KAN-885: Ctrl+C diagnostic process or port verification failed')
  }
}

export interface AcceptanceDevCtrlcProbeWriteInput {
  statePath: string
  state: AcceptanceDevCtrlcProbeState
}

/**
 * KAN-885/T3 L6: write an accredited diagnostic record to a new file only.
 * The parent directory must already exist; this function never overwrites an
 * existing file or provisions any directory, process, port or SQLite state.
 */
export async function writeAcceptanceDevCtrlcProbeState(
  input: AcceptanceDevCtrlcProbeWriteInput,
): Promise<void> {
  if (typeof input.statePath !== 'string' || !isAbsolute(input.statePath)) {
    throw new Error('KAN-885: Ctrl+C diagnostic state path must be absolute')
  }

  let serialized: string
  try {
    serialized = JSON.stringify(input.state)
    parseAcceptanceDevCtrlcProbeState(serialized)
  } catch {
    throw new Error('KAN-885: invalid Ctrl+C diagnostic state for writing')
  }
  if (Buffer.byteLength(serialized, 'utf8') > 4096) {
    throw new Error('KAN-885: Ctrl+C diagnostic state exceeds size limit')
  }

  try {
    // wx is exclusive (O_EXCL|O_CREAT): pre-existing files and symlinks are
    // rejected atomically. Restrict POSIX mode; Windows ACLs need separate
    // accreditation before trusting records as authoritative.
    const handle = await open(input.statePath, 'wx', 0o600)
    try {
      await handle.writeFile(serialized, { encoding: 'utf8' })
    } finally {
      await handle.close()
    }
  } catch {
    throw new Error('KAN-885: unable to create exclusive Ctrl+C diagnostic state')
  }
}

export interface AcceptanceDevCtrlcProbeRunPlanInput {
  projectRoot: string
  statePath: string
  nonce: string
  inheritedEnv: NodeJS.ProcessEnv
}

export interface AcceptanceDevCtrlcProbeRunPlan {
  command: string
  args: string[]
  cwd: string
  env: NodeJS.ProcessEnv
}

/**
 * KAN-885/T3 L6: pure, shell-free launch description for a test-only worker.
 * Does not start the worker, access files or enable the CLI --run command.
 */
export function buildAcceptanceDevCtrlcProbeRunPlan(
  input: AcceptanceDevCtrlcProbeRunPlanInput,
): AcceptanceDevCtrlcProbeRunPlan {
  if (
    typeof input.projectRoot !== 'string' || !isAbsolute(input.projectRoot)
    || typeof input.statePath !== 'string' || !isAbsolute(input.statePath)
    || typeof input.nonce !== 'string' || !/^[a-f0-9]{32}$/.test(input.nonce)
  ) {
    throw new Error('KAN-885: invalid disposable Ctrl+C probe launch arguments')
  }

  // The state must live beneath, not at or outside, the project root.
  const stateRelative = relative(input.projectRoot, input.statePath)
  if (
    stateRelative.length === 0
    || stateRelative === '..'
    || stateRelative.startsWith('..\\')
    || stateRelative.startsWith('../')
    || isAbsolute(stateRelative)
  ) {
    throw new Error('KAN-885: disposable Ctrl+C state must be a project-local file')
  }

  const env: NodeJS.ProcessEnv = { NODE_ENV: 'test' }
  // Permit only the OS-level variables needed to launch Node on Windows.
  // Never spread the inherited environment into the worker.
  for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'PATHEXT', 'TEMP', 'TMP']) {
    const value = input.inheritedEnv[key]
    if (typeof value === 'string') env[key] = value
  }

  return {
    command: process.execPath,
    args: [
      '--import',
      'tsx',
      join(input.projectRoot, 'scripts', 'acceptance-dev-windows-ctrlc-probe-worker.ts'),
      '--state',
      input.statePath,
      '--nonce',
      input.nonce,
    ],
    cwd: input.projectRoot,
    env,
  }
}
