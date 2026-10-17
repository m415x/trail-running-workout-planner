import type Database from 'better-sqlite3'

import type { ReviewSnapshotScopeResult } from './authorized-review-snapshot-scope'
import { readReviewSnapshotEffectiveManifestSqlite } from './review-snapshot-effective-manifest-sqlite'
import { evaluateReviewSnapshotSourceFreshness } from './review-snapshot-source-freshness'
import {
  consumeReviewSnapshotSqlite,
  type ReviewSnapshotRecord,
} from './review-snapshot-sqlite-repository'

interface ConfirmRequest {
  readonly groupTrainingPlanId: string
  readonly snapshotId: string
}

interface ConfirmationDependencies {
  readonly sqlite: Database.Database
  readonly authorize: (request: ConfirmRequest) => Promise<ReviewSnapshotScopeResult>
  readonly now: () => string
  /**
   * Trusted synchronous writer, called with the persisted snapshot inside
   * the same SQLite IMMEDIATE transaction as its consumption CAS.
   * Production must supply the existing reconciliation and audit writer.
   */
  readonly persist: (snapshot: ReviewSnapshotRecord) => string
}

/**
 * T5.4 — authorized opaque-ID CONFIRM. A source manifest is read only after
 * reauthorization and inside the CAS transaction; any stale input or writer
 * failure aborts that entire transaction (including the status change).
 *
 * SQL-scoped ownership is not H2/H3/H4A actor authority. The authorize
 * dependency must enforce those capabilities using current server evidence.
 * No proposals or explanations are accepted from the client.
 */
export function createAuthorizedReviewSnapshotConfirmationOperations(
  dependencies: ConfirmationDependencies,
) {
  return {
    async confirm(request: ConfirmRequest) {
      if (!request.groupTrainingPlanId?.trim() || !request.snapshotId?.trim()) {
        return { kind: 'denied' as const }
      }

      const decision = await dependencies.authorize(request)
      if (decision.kind !== 'authorized') {
        return { kind: 'denied' as const }
      }

      const scope = decision.scope
      if (scope.groupTrainingPlanId !== request.groupTrainingPlanId) {
        return { kind: 'denied' as const }
      }

      return consumeReviewSnapshotSqlite(
        dependencies.sqlite,
        {
          id: request.snapshotId,
          userId: scope.userId,
          teamId: scope.teamId,
          groupTrainingPlanId: scope.groupTrainingPlanId,
        },
        dependencies.now(),
        snapshot => {
          if (snapshot.groupId !== scope.groupId ||
            snapshot.planningCohortId !== scope.planningCohortId) {
            throw new Error('reconciliation_conflict: snapshot planning scope changed')
          }

          // This callback is executed by consumeReviewSnapshotSqlite within
          // the same IMMEDIATE SQLite transaction as the CAS and persist().
          const current = readReviewSnapshotEffectiveManifestSqlite(
            dependencies.sqlite,
            {
              groupTrainingPlanId: scope.groupTrainingPlanId,
              teamId: scope.teamId,
              groupId: scope.groupId,
            },
          )
          if (evaluateReviewSnapshotSourceFreshness(
            snapshot.sourceManifest, current,
          ).kind !== 'current') {
            throw new Error('generation_stale: source facts changed before confirmation')
          }

          return dependencies.persist(snapshot)
        },
      )
    },
  }
}
