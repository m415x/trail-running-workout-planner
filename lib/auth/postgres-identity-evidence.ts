import type postgres from 'postgres'

import type { ExternalIdentityLookup } from './server-session-identity'

type Client=ReturnType<typeof postgres>

/**
 * Read-only PostgreSQL H1 evidence, shared by login/session compositions.
 * Deleted links are returned explicitly so the existing H2 identity resolver
 * can fail closed; no lookup against SQLite is ever attempted here.
 */
export function createPostgresIdentityEvidence(client:Client) {
  return {
    async findByProviderSubject(provider:string,subject:string) {
      return Array.from(await client<{
        linkId:string;userId:string;linkIsDeleted:boolean;userIsDeleted:boolean
      }[]>`
        SELECT l.id AS "linkId",l.user_id AS "userId",
          l.is_deleted AS "linkIsDeleted",u.is_deleted AS "userIsDeleted"
        FROM external_identity_links l
        JOIN users u ON u.id=l.user_id
        WHERE l.provider=${provider} AND l.subject=${subject}
      `)
    },
    async loadMemberships(userId:string) {
      return client<{
        userId:string;teamId:string;preset:'athlete'|'assistant'|'coach'|'admin';
        effectiveFrom:string;effectiveUntil:string|null;isActive:boolean;isDeleted:boolean
      }[]>`
        SELECT user_id AS "userId",team_id AS "teamId",preset,
          effective_from AS "effectiveFrom",effective_until AS "effectiveUntil",
          is_active AS "isActive",is_deleted AS "isDeleted"
        FROM team_memberships WHERE user_id=${userId}
      `
    },
  } satisfies ExternalIdentityLookup & {
    loadMemberships(userId:string):Promise<unknown>
  }
}
