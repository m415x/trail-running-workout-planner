import type postgres from 'postgres'

import type { ReviewSnapshotScopeResult } from './authorized-review-snapshot-scope'
import { readReviewSnapshotEffectiveManifestPostgres } from './review-snapshot-effective-manifest-postgres'
import {
  consumeReviewSnapshotPostgres,
  type SnapshotRow,
} from './review-snapshot-postgres-repository'
import { evaluateReviewSnapshotSourceFreshness } from './review-snapshot-source-freshness'

type PostgresClient = ReturnType<typeof postgres>

interface ConfirmRequest {
  readonly groupTrainingPlanId: string
  readonly snapshotId: string
}

interface ConfirmationDependencies {
  readonly client: PostgresClient
  /**
   * Trusted server authorization, run with the CURRENT transaction for every
   * retry. Must derive actor, Team, Group, Plan and H2/H3/H4A permissions
   * from server-controlled state; the request contains no actor identity.
   */
  readonly authorize: (
    tx: postgres.TransactionSql,
    request: ConfirmRequest,
  ) => Promise<ReviewSnapshotScopeResult>
  readonly now: () => string
  /** Must use tx, and return a reference to durable reconciled state. */
  readonly persist: (
    tx: postgres.TransactionSql,
    snapshot: SnapshotRow,
  ) => Promise<string>
}

/**
 * PG-3 — DENY before CAS, reauthorization per SERIALIZABLE attempt, fresh
 * generation facts and writer in the very same transaction as consumption.
 *
 * This adapter is not itself a concrete H2/H3/H4A authorizer nor a shared
 * Session reconciliation implementation: both are trusted dependencies.
 */
export function createAuthorizedReviewSnapshotPostgresConfirmationOperations(
  dependencies: ConfirmationDependencies,
) {
  return {
    async confirm(request: ConfirmRequest) {
      if (!request.groupTrainingPlanId?.trim() || !request.snapshotId?.trim()) {
        return { kind: 'denied' as const }
      }

      return consumeReviewSnapshotPostgres(
        dependencies.client,
        async tx => {
          const decision = await dependencies.authorize(tx, request)
          if (decision.kind !== 'authorized') return null
          const scope = decision.scope
          if (scope.groupTrainingPlanId !== request.groupTrainingPlanId) return null
          return {
            id: request.snapshotId,
            userId: scope.userId,
            teamId: scope.teamId,
            groupTrainingPlanId: scope.groupTrainingPlanId,
          }
        },
        dependencies.now(),
        async (tx, snapshot) => {
          // Recheck the saved planning identity and current authoritative
          // Plan lineage even after the transaction-local actor decision.
          const decision = await dependencies.authorize(tx, request)
          if (decision.kind !== 'authorized') {
            throw new Error('reconciliation_conflict: authorization revoked during confirmation')
          }
          const scope = decision.scope
          if (snapshot.userId !== scope.userId ||
            snapshot.teamId !== scope.teamId ||
            snapshot.groupTrainingPlanId !== scope.groupTrainingPlanId ||
            snapshot.groupId !== scope.groupId ||
            snapshot.planningCohortId !== scope.planningCohortId) {
            throw new Error('reconciliation_conflict: snapshot planning scope changed')
          }
          const current = await readReviewSnapshotEffectiveManifestPostgres(tx, {
            groupTrainingPlanId: scope.groupTrainingPlanId,
            teamId: scope.teamId,
            groupId: scope.groupId,
          })
          if (evaluateReviewSnapshotSourceFreshness(
            snapshot.sourceManifest, current,
          ).kind !== 'current') {
            throw new Error('generation_stale: source facts changed before confirmation')
          }

          return dependencies.persist(tx, snapshot)
        },
      )
    },
  }
}
