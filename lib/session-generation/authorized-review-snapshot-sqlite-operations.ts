import {
  createAuthorizedReviewSnapshotOperations,
} from './authorized-review-snapshot-operations'
import {
  readReviewSnapshotEffectiveManifestSqlite,
} from './review-snapshot-effective-manifest-sqlite'

type BaseDependencies = Parameters<typeof createAuthorizedReviewSnapshotOperations>[0]

/**
 * KAN-790/T5.3 — SQLite composition boundary for authorized review CREATE.
 *
 * The source freshness dependency is server-owned and cannot be substituted
 * by a caller-supplied digest. The underlying operation authorizes before
 * generation, reauthorizes after generation and compares against this fresh
 * SQL manifest before snapshot allocation.
 *
 * This is not the Next.js Server Action adapter, nor does it make the
 * generate() dependency trustworthy: production must source generation and
 * its initial manifest from the same effective SQL inputs.
 */
export function createSqliteBackedAuthorizedReviewSnapshotOperations(
  dependencies: Omit<BaseDependencies, 'readCurrentSourceManifest'>,
): ReturnType<typeof createAuthorizedReviewSnapshotOperations> {
  return createAuthorizedReviewSnapshotOperations({
    ...dependencies,
    readCurrentSourceManifest: async scope =>
      readReviewSnapshotEffectiveManifestSqlite(dependencies.sqlite, {
        groupTrainingPlanId: scope.groupTrainingPlanId,
        teamId: scope.teamId,
        groupId: scope.groupId,
      }),
  })
}
