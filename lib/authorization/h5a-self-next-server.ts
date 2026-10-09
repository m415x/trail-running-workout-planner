import { createActiveTeamNextServerContext } from './active-team-next-server'
import { createH4aNextServerEvidenceSource } from './h4a-next-server-authorization'
import { createH5aSelfContextBoundary } from './h5a-self-context'

/**
 * Request-scoped H5A SELF authority wired to the existing H1/H3 persistence
 * and validated H4A active-Team context. No client identity/Team inputs.
 */
export function createH5aSelfNextServerContext() {
  const activeTeam = createActiveTeamNextServerContext()
  const evidence = createH4aNextServerEvidenceSource()

  return createH5aSelfContextBoundary({
    resolveActiveTeam: (userId) => activeTeam.resolve(userId),
    loadMemberships: (userId, teamId) => evidence.loadMemberships(userId, teamId),
    loadAthleteProfiles: (userId, teamId) => evidence.loadAthleteProfiles(userId, teamId),
  })
}
