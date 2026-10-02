type ApprovedLocalPinRequest = {
  /** Caller-provided trusted source, never derived from PostgreSQL itself. */
  readTrustedDocument: () => Promise<string>
}

const expectedKind = 'coach-supabase-local'
const expectedProject = 'trail-running-workout-planner'

/**
 * Read explicit operator approval from an independently supplied document.
 * This does not read environment variables, contact PostgreSQL, establish the
 * source's trust, or authorize a mutation on its own.
 */
export async function readApprovedLocalSandboxPin(
  request: ApprovedLocalPinRequest,
): Promise<string> {
  let document: unknown

  try {
    const raw = await request.readTrustedDocument()
    if (typeof raw !== 'string' || raw.length > 4096) {
      throw new Error('Invalid document')
    }
    document = JSON.parse(raw)
  } catch {
    // File/JSON errors can include paths or sensitive contents.
    throw new Error('Trusted local sandbox pin document unavailable')
  }

  if (
    !document
    || typeof document !== 'object'
    || Array.isArray(document)
  ) {
    throw new Error('Trusted local sandbox pin approval invalid')
  }

  const fields = document as Record<string, unknown>
  if (
    Object.keys(fields).length !== 4
    || fields.kind !== expectedKind
    || fields.projectId !== expectedProject
    || fields.approvedByOperator !== true
    || typeof fields.approvedClusterSystemIdentifier !== 'string'
    || !/^[0-9]{1,20}$/.test(fields.approvedClusterSystemIdentifier)
  ) {
    throw new Error('Trusted local sandbox pin approval invalid')
  }

  return fields.approvedClusterSystemIdentifier
}
