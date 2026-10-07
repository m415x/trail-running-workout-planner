import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import {
  athleteProfiles,
  authorizationGrants,
  teamMemberships,
} from '@/db/schema'

import { createActiveTeamNextServerContext } from './active-team-next-server'
import { createH4aActiveTeamAuthorizationBoundary } from './h4a-active-team-authorization'
import { createH4aAuthorizationAdapter } from './h4a-authorization-adapter'
import type { CapabilityKey } from './capability-catalog'
import type { AuthorizationScope } from './scope-resolution'

function createH4aNextServerEvidenceSource() {
  return {
    async loadMemberships(userId: string, teamId: string) {
      return db
        .select({
          userId: teamMemberships.userId,
          teamId: teamMemberships.teamId,
          preset: teamMemberships.preset,
          effectiveFrom: teamMemberships.effectiveFrom,
          effectiveUntil: teamMemberships.effectiveUntil,
          isActive: teamMemberships.isActive,
        })
        .from(teamMemberships)
        .where(and(
          eq(teamMemberships.userId, userId),
          eq(teamMemberships.teamId, teamId),
          eq(teamMemberships.isDeleted, false),
        ))
        .all()
    },

    async loadAthleteProfiles(userId: string, teamId: string) {
      return db
        .select({
          id: athleteProfiles.id,
          userId: athleteProfiles.userId,
          teamId: athleteProfiles.teamId,
        })
        .from(athleteProfiles)
        .where(and(
          eq(athleteProfiles.userId, userId),
          eq(athleteProfiles.teamId, teamId),
          eq(athleteProfiles.isDeleted, false),
        ))
        .all()
    },

    async loadGrants(userId: string, teamId: string) {
      const rows = await db
        .select({
          id: authorizationGrants.id,
          beneficiaryUserId: authorizationGrants.beneficiaryUserId,
          teamId: authorizationGrants.teamId,
          capability: authorizationGrants.capability,
          scope: authorizationGrants.scope,
          scopeTargetId: authorizationGrants.scopeTargetId,
          effectiveFrom: authorizationGrants.effectiveFrom,
          effectiveUntil: authorizationGrants.effectiveUntil,
          grantedByUserId: authorizationGrants.grantedByUserId,
          reason: authorizationGrants.reason,
          revokedAt: authorizationGrants.revokedAt,
          revokedByUserId: authorizationGrants.revokedByUserId,
          revocationReason: authorizationGrants.revocationReason,
        })
        .from(authorizationGrants)
        .where(and(
          eq(authorizationGrants.beneficiaryUserId, userId),
          eq(authorizationGrants.teamId, teamId),
          eq(authorizationGrants.isDeleted, false),
        ))
        .all()

      return rows.map((row) => ({
        ...row,
        capability: row.capability as CapabilityKey,
        scope: row.scope as AuthorizationScope,
      }))
    },
  }
}

export function createH4aNextServerAuthorizationBoundary() {
  const activeTeam = createActiveTeamNextServerContext()
  const authorization = createH4aAuthorizationAdapter(
    createH4aNextServerEvidenceSource(),
  )

  return createH4aActiveTeamAuthorizationBoundary({
    resolveActiveTeam: (userId) => activeTeam.resolve(userId),
    authorize: (access, request) => authorization.authorize(access, request),
  })
}
