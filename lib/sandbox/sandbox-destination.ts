/**
 * KAN-583: Pure, non-network inspection of a proposed PostgreSQL destination.
 *
 * This is only a structural preflight. It does not certify the physical database,
 * grant permission to execute a mutation, or replace the later T2 identity check.
 * Never include the connection URL (or an underlying URL parsing error) in errors.
 */
export type SandboxDestinationInput = {
  kind?: string
  directUrl?: string
  allowedCloudProjectRefs?: readonly string[]
}

export type SandboxDestination =
  | { kind: 'local'; host: '127.0.0.1'; port: 54322; database: 'postgres' }
  | { kind: 'cloud'; host: string; port: 5432; database: 'postgres'; projectRef: string }

export function inspectSandboxDestination(input: SandboxDestinationInput): SandboxDestination {
  if (input.kind !== 'local' && input.kind !== 'cloud') {
    throw new Error('Explicit sandbox kind is required (local or cloud)')
  }

  if (!input.directUrl?.trim()) {
    throw new Error('Explicit sandbox direct URL is required')
  }

  let parsed: URL
  try {
    parsed = new URL(input.directUrl)
  } catch {
    throw new Error('Invalid sandbox direct URL')
  }

  // No defaults, redirects, URI side channels or credentials in diagnostics.
  const directPostgres = parsed.protocol === 'postgresql:'
    && parsed.username === 'postgres'
    && parsed.password.length > 0
    && parsed.pathname === '/postgres'
    && parsed.hash === ''

  if (input.kind === 'local') {
    if (
      !directPostgres
      || parsed.hostname !== '127.0.0.1'
      || parsed.port !== '54322'
      || parsed.search !== ''
    ) {
      throw new Error('Unrecognized local sandbox endpoint')
    }

    return { kind: 'local', host: '127.0.0.1', port: 54322, database: 'postgres' }
  }

  if (!input.allowedCloudProjectRefs?.length) {
    throw new Error('An explicit cloud project allowlist is required')
  }

  const match = /^db\\.([a-z0-9]+)\\.supabase\\.co$/.exec(parsed.hostname)
  const projectRef = match?.[1]

  if (
    !directPostgres
    || !projectRef
    || !input.allowedCloudProjectRefs.includes(projectRef)
    || parsed.port !== '5432'
    || parsed.searchParams.size !== 1
    || parsed.searchParams.get('sslmode') !== 'require'
  ) {
    throw new Error('Unrecognized cloud sandbox endpoint')
  }

  return {
    kind: 'cloud',
    host: parsed.hostname,
    port: 5432,
    database: 'postgres',
    projectRef,
  }
}
