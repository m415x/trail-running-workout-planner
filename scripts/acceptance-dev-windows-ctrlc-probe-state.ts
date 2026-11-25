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
