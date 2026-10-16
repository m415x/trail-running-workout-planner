import type postgres from 'postgres'
import type { H4aAuthorizationEvidenceSource } from './h4a-authorization-adapter'
import type { CapabilityKey } from './capability-catalog'
import type { AuthorizationScope } from './scope-resolution'

type Client=ReturnType<typeof postgres>

/** PostgreSQL H4A evidence; authorization rules remain in the shared adapter. */
export function createPostgresH4aEvidenceSource(sql:Client):H4aAuthorizationEvidenceSource {
  return {
    async loadMemberships(userId,teamId) {
      return Array.from(await sql<{
        userId:string;teamId:string;preset:'athlete'|'assistant'|'coach'|'admin';
        effectiveFrom:string;effectiveUntil:string|null;isActive:boolean
      }[]>`
        SELECT user_id AS "userId",team_id AS "teamId",preset,
          effective_from AS "effectiveFrom",effective_until AS "effectiveUntil",
          is_active AS "isActive"
        FROM team_memberships WHERE user_id=${userId} AND team_id=${teamId}
          AND is_deleted=false
      `)
    },
    async loadAthleteProfiles(userId,teamId) {
      return Array.from(await sql<{id:string;userId:string;teamId:string}[]>`
        SELECT id,user_id AS "userId",team_id AS "teamId"
        FROM athlete_profiles WHERE user_id=${userId} AND team_id=${teamId}
          AND is_deleted=false
      `)
    },
    async loadGrants(userId,teamId) {
      const rows=await sql<{
        id:string;beneficiaryUserId:string;teamId:string;
        capability:string;scope:string;scopeTargetId:string|null;
        effectiveFrom:string;effectiveUntil:string|null;
        grantedByUserId:string;reason:string;
        revokedAt:string|null;revokedByUserId:string|null;revocationReason:string|null
      }[]>`
        SELECT id,beneficiary_user_id AS "beneficiaryUserId",
          team_id AS "teamId",capability,scope,scope_target_id AS "scopeTargetId",
          effective_from AS "effectiveFrom",effective_until AS "effectiveUntil",
          granted_by_user_id AS "grantedByUserId",reason,
          revoked_at AS "revokedAt",revoked_by_user_id AS "revokedByUserId",
          revocation_reason AS "revocationReason"
        FROM authorization_grants WHERE beneficiary_user_id=${userId}
          AND team_id=${teamId} AND is_deleted=false
      `
      return Array.from(rows,row=>{
        // H4A grants require a bounded validity interval. Never invent an
        // expiry for malformed PostgreSQL evidence or broaden a grant.
        if(row.effectiveUntil===null) {
          throw new Error('Invalid PostgreSQL authorization grant validity')
        }
        return {
          ...row,effectiveUntil:row.effectiveUntil,
          capability:row.capability as CapabilityKey,
          scope:row.scope as AuthorizationScope,
        }
      })
    },
  }
}
