import { createActiveTeamNextServerContext } from './active-team-next-server'
import { createH4aNextServerEvidenceSource } from './h4a-next-server-authorization'
import { createH5bSelfContextBoundary } from './h5b-self-context'

/** H5B request-scoped evidence wiring; H2 session is supplied by the caller. */
export function createH5bSelfNextServerContext() {
  const activeTeam = createActiveTeamNextServerContext()
  const evidence = createH4aNextServerEvidenceSource()

  return createH5bSelfContextBoundary({
    resolveActiveTeam: (userId) => activeTeam.resolve(userId),
    loadMemberships: (userId, teamId) => evidence.loadMemberships(userId, teamId),
    loadAthleteProfiles: (userId, teamId) => evidence.loadAthleteProfiles(userId, teamId),
  })
}
