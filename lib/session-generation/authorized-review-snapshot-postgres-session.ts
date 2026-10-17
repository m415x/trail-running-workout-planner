import type postgres from 'postgres'

import { readSupabaseServerSessionState, type SupabaseServerSessionAuth } from '@/lib/auth/supabase-server-session-state'
import { resolveAuthenticatedEptIdentity } from '@/lib/auth/server-session-identity'
import { resolveActiveTeamContext } from '@/lib/authorization/active-team-context'
import { createAuthorizedReviewSnapshotPostgresTransactionOperations } from './authorized-review-snapshot-postgres-transaction'

type Client = ReturnType<typeof postgres>
type Transaction = postgres.TransactionSql

interface Dependencies {
  readonly client: Client
  readonly auth: SupabaseServerSessionAuth
  /** Trusted server cookie reader. A cookie is only a preference, never authority. */
  readonly readPersistedTeamId: () => Promise<string | null>
  readonly now: () => string
}

/**
 * Product-facing H2/H3 PostgreSQL composition. Supabase verification uses
 * the existing server-session algorithm. EPT link and active-Team membership
 * are read on the same transaction as CAS, freshness and reconciliation.
 */
export function createAuthorizedReviewSnapshotPostgresSessionOperations(
  dependencies: Dependencies,
) {
  return createAuthorizedReviewSnapshotPostgresTransactionOperations({
    client: dependencies.client,
    now: dependencies.now,
    authenticatedUserId: async (tx: Transaction) => {
      const session = await readSupabaseServerSessionState(dependencies.auth)
      if (session.status !== 'verified') return null
      const identity = await resolveAuthenticatedEptIdentity(
        session.externalSubject,
        {
          findByProviderSubject: async (provider, subject) => {
            return tx<{
              linkId:string;userId:string;linkIsDeleted:boolean;userIsDeleted:boolean
            }[]>`
              SELECT l.id AS "linkId",l.user_id AS "userId",
                l.is_deleted AS "linkIsDeleted",u.is_deleted AS "userIsDeleted"
              FROM external_identity_links AS l
              JOIN users AS u ON u.id=l.user_id
              WHERE l.provider=${provider} AND l.subject=${subject}
            `
          },
        },
      )
      return identity.status === 'authenticated' ? identity.userId : null
    },
    selectedTeamId: async (userId: string, tx: Transaction) => {
      const memberships=await tx<{
        teamId:string;isActive:boolean;isDeleted:boolean;
        effectiveFrom:string;effectiveUntil:string|null
      }[]>`
        SELECT team_id AS "teamId",is_active AS "isActive",
          is_deleted AS "isDeleted",effective_from AS "effectiveFrom",
          effective_until AS "effectiveUntil"
        FROM team_memberships WHERE user_id=${userId}
      `
      const selected = resolveActiveTeamContext({
        persistedTeamId: await dependencies.readPersistedTeamId(),
        memberships,
        onDate: dependencies.now(),
      })
      return selected.status === 'resolved' ? selected.teamId : null
    },
  })
}
