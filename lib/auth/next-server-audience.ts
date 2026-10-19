import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { teamMemberships } from '@/db/schema'
import { createNextServerIdentityEvidence } from './identity-backend-next-server'
import { createActiveTeamNextServerContext } from '@/lib/authorization/active-team-next-server'
import { resolveAudienceDestination } from './audience-destination'

export async function resolveNextServerAudience(userId: string) {
  const activeTeam = await createActiveTeamNextServerContext().resolve(userId)
  if (activeTeam.status !== 'resolved') {
    return resolveAudienceDestination({
      access: { status: 'authenticated', userId },
      team: activeTeam,
      memberships: [],
      at: new Date().toISOString(),
    })
  }

  const identityBackend=createNextServerIdentityEvidence()
  const memberships = identityBackend.backend==='postgres'
    ? await identityBackend.memberships.loadMemberships(userId)
    : await db.select({
    userId: teamMemberships.userId,
    teamId: teamMemberships.teamId,
    preset: teamMemberships.preset,
    isActive: teamMemberships.isActive,
    isDeleted: teamMemberships.isDeleted,
    effectiveFrom: teamMemberships.effectiveFrom,
    effectiveUntil: teamMemberships.effectiveUntil,
  }).from(teamMemberships).where(eq(teamMemberships.userId, userId)).all()

  return resolveAudienceDestination({
    access: { status: 'authenticated', userId },
    team: activeTeam,
    memberships,
    at: new Date().toISOString(),
  })
}
