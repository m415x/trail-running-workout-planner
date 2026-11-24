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
