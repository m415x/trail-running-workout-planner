/**
 * Deployment-owned choice of identity persistence.
 * Never accept a request-derived override; unknown configuration is fatal.
 */
export type IdentityBackend = 'sqlite' | 'postgres'

export function resolveIdentityBackend(configured: string | undefined): IdentityBackend {
  if (configured === undefined || configured === '' || configured === 'sqlite') return 'sqlite'
  if (configured === 'postgres') return 'postgres'
  throw new Error('Invalid server identity backend configuration')
}

export function configuredIdentityBackend(): IdentityBackend {
  return resolveIdentityBackend(process.env.EPT_IDENTITY_BACKEND)
}
