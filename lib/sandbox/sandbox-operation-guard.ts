import { inspectSandboxDestination, type SandboxDestinationInput } from './sandbox-destination'

export type SandboxMutationOperation = 'migrate' | 'seed' | 'reset'

/**
 * Evidence read from the *same database connection* the caller intends to use
 * for the operation. This interface is an injectable boundary for TDD, not a
 * substitute for a real physical-identity query (to be wired in T3).
 */
export type PhysicalSandboxIdentity = {
  database?: string
  environmentMarker?: string
  projectRef?: string | null
}

export type SandboxMutationRequest<T> = {
  destination: SandboxDestinationInput
  operation: SandboxMutationOperation
  confirmation?: string
  readPhysicalIdentity: () => Promise<PhysicalSandboxIdentity>
  execute: () => Promise<T>
}

/**
 * Local-only authorization boundary. No cloud mutation or reset is authorized
 * in T2, even when a caller supplies valid-looking connection credentials.
 *
 * The callback boundary must be connected to the same authenticated PostgreSQL
 * session/target during T3; this function alone does not attest remote identity.
 */
export async function authorizeSandboxMutation<T>(request: SandboxMutationRequest<T>): Promise<T> {
  const inspected = inspectSandboxDestination(request.destination)

  // Cloud provisioning and mutation have not been approved. A syntactically
  // allowlisted Supabase URL is not permission to operate on that project.
  if (inspected.kind === 'cloud') {
    throw new Error('Cloud sandbox mutations are not authorized')
  }

  // T7 owns a bounded, audited allowlist of application objects for reset.
  // Deny unscoped reset now, rather than treating a confirmation string as
  // permission to execute an arbitrary destructive callback.
  if (request.operation === 'reset') {
    throw new Error('Reset confirmation and scoped reset procedure are not authorized')
  }

  if (request.operation !== 'migrate' && request.operation !== 'seed') {
    throw new Error('Unrecognized sandbox operation')
  }

  // An operation-specific confirmation is mandatory, not an authorization to mutate.
  // Physical identity and independent operator permission remain separate gates.
  if (request.confirmation !== request.operation) {
    throw new Error('Sandbox operation-specific confirmation required')
  }

  let identity: PhysicalSandboxIdentity
  try {
    identity = await request.readPhysicalIdentity()
  } catch {
    // Driver diagnostics may contain a PostgreSQL connection string. Do not
    // propagate the underlying exception or log potentially secret material.
    throw new Error('Sandbox physical identity verification failed')
  }

  if (
    !identity
    || identity.database !== inspected.database
    || identity.environmentMarker !== 'trail-running-coach-local-sandbox'
    || identity.projectRef !== null
  ) {
    throw new Error('Sandbox physical identity marker mismatch')
  }

  return request.execute()
}
