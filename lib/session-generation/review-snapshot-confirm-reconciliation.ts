import { db, sqliteConnection } from '@/db'
import { parseGenerationExplanationSnapshots } from './generation-explanation-persistence'
import { reconcileAndPersistGeneratedSessionsSqlite } from './review-snapshot-reconciliation-writer'
import type { ReviewSnapshotRecord } from './review-snapshot-sqlite-repository'
import type { SharedSessionGenerationResult } from '@/types/training/session-generation.types'

interface ReconciliationPersistDependencies {
  /** H2/H3/H4A authorization for every potentially affected Sporting Group. */
  readonly authorizedGroupIds: ReadonlySet<string>
  readonly now: () => string
}

function parseStoredProposal(value: unknown): SharedSessionGenerationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    !('events' in value) || !Array.isArray(value.events)) {
    throw new Error('reconciliation_conflict: invalid stored snapshot proposal')
  }
  return value as SharedSessionGenerationResult
}

/**
 * Synchronous callback used exclusively inside the snapshot consumption CAS.
 * The proposal and historical explanation facts come from the persisted SQL
 * snapshot, never from the browser. The existing shared writer owns every
 * Session, prescription and audit change on the canonical SQLite connection.
 *
 * Authorization of potentially affected groups must happen before entering
 * this callback. The writer rejects any newly affected group discovered while
 * reading the up-to-date reconciliation set within the CAS transaction.
 */
export function createReviewSnapshotReconciliationPersist(
  dependencies: ReconciliationPersistDependencies,
): (snapshot: ReviewSnapshotRecord) => string {
  return snapshot => {
    if (!sqliteConnection.inTransaction) {
      throw new Error('reconciliation_conflict: confirmation transaction missing')
    }

    const proposal = parseStoredProposal(snapshot.proposal)
    const generationExplanations = parseGenerationExplanationSnapshots(
      JSON.stringify(snapshot.generationExplanations),
    )

    reconcileAndPersistGeneratedSessionsSqlite({
      database: db,
      sqlite: sqliteConnection,
      withinExistingTransaction: true,
      planId: snapshot.groupTrainingPlanId,
      teamId: snapshot.teamId,
      userId: snapshot.userId,
      proposal,
      generationExplanations,
      authorizedGroupIds: dependencies.authorizedGroupIds,
      now: dependencies.now(),
    })

    // The authorized Plan is the durable identity for this reconciliation.
    // The CAS row records it for repeat confirmations; no orphan opaque UUID.
    const resultReference = snapshot.groupTrainingPlanId
    return resultReference
  }
}
