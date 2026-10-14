import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'

import type {
  AuthorizedReviewSnapshotScope,
  ReviewSnapshotScopeResult,
} from '@/lib/session-generation/authorized-review-snapshot-scope'
import { validateGeneratedMicrocycleLineageSqlite } from '@/lib/session-generation/review-snapshot-microcycle-lineage-sqlite'
import { evaluateReviewSnapshotSourceFreshness } from '@/lib/session-generation/review-snapshot-source-freshness'
import {
  createReviewSnapshotSqlite,
  getActiveReviewSnapshotSqlite,
  type ReviewSnapshotRecord,
} from '@/lib/session-generation/review-snapshot-sqlite-repository'

interface SnapshotGeneratedData {
  readonly proposal: unknown
  readonly generationExplanations: unknown
  readonly sourceManifest: unknown
  readonly schemaVersion: string
  readonly generatorVersion: string
  readonly sessionCount: number
  readonly microcycleCount: number
}

/**
 * Cross-check counts against the actual generated Plan-scoped event payload.
 * The SQL repository's capacity guard must not trust metadata supplied by a
 * caller, even when the generator is server-side. Full planning ownership and
 * source-manifest verification are separate T5.3 boundaries.
 */
function assertGeneratedProposalCounts(generated: SnapshotGeneratedData, scope: AuthorizedReviewSnapshotScope): readonly string[] {
  const proposal = generated.proposal
  if (proposal === null || typeof proposal !== 'object' ||
    !('events' in proposal) || !Array.isArray(proposal.events)) {
    throw new Error('Snapshot proposal events structure is invalid')
  }

  const microcycleIds = new Set<string>()
  const generationKeys = new Set<string>()
  const sharedEventKeys = new Set<string>()
  for (const event of proposal.events) {
    if (event === null || typeof event !== 'object' ||
      !('prescriptions' in event) || !Array.isArray(event.prescriptions)) {
      throw new Error('Snapshot proposal prescriptions structure is invalid')
    }
    if (!('sharedEventKey' in event) ||
      typeof event.sharedEventKey !== 'string' || !event.sharedEventKey.trim()) {
      throw new Error('Snapshot sharedEventKey event identity is invalid')
    }
    if (sharedEventKeys.has(event.sharedEventKey)) {
      throw new Error('Snapshot duplicate sharedEventKey event identity')
    }
    sharedEventKeys.add(event.sharedEventKey)
    for (const item of event.prescriptions) {
      if (item === null || typeof item !== 'object' ||
        !('prescription' in item) || item.prescription === null ||
        typeof item.prescription !== 'object' ||
        !('microcycleId' in item.prescription) ||
        typeof item.prescription.microcycleId !== 'string' ||
        !item.prescription.microcycleId.trim()) {
        throw new Error('Snapshot proposal microcycle identity is invalid')
      }
      if (!('groupId' in item.prescription) ||
        item.prescription.groupId !== scope.groupId) {
        throw new Error('Snapshot prescription Sporting Group ownership differs from authorized planning scope')
      }
      if (!('generationKey' in item) ||
        typeof item.generationKey !== 'string' || !item.generationKey.trim()) {
        throw new Error('Snapshot prescription generationKey identity is invalid')
      }
      if (generationKeys.has(item.generationKey)) {
        throw new Error('Snapshot duplicate generationKey prescription identity')
      }
      generationKeys.add(item.generationKey)
      microcycleIds.add(item.prescription.microcycleId)
    }
  }

  if (generated.sessionCount !== proposal.events.length ||
    generated.microcycleCount !== microcycleIds.size) {
    throw new Error('Snapshot proposal count metadata differs from generated events and microcycles')
  }
  return [...microcycleIds]
}

interface SnapshotRequest {
  readonly groupTrainingPlanId: string
  /** Test/server-provided identity only; product Server Actions must generate an opaque ID server-side. */
  readonly snapshotId?: string
}

interface OperationsDependencies {
  readonly sqlite: Database.Database
  readonly authorize: (request: SnapshotRequest) => Promise<ReviewSnapshotScopeResult>
  readonly generate: (scope: AuthorizedReviewSnapshotScope) => Promise<SnapshotGeneratedData>
  /** Transitional optional typing for legacy fixtures; CREATE rejects absent readers at runtime. */
  readonly readCurrentSourceManifest?: (scope: AuthorizedReviewSnapshotScope) => Promise<unknown>
  readonly now: () => string
  readonly createId?: () => string
}

/**
 * T5.2 service contract: generation occurs only after scope authorization and
 * only on an explicit CREATE invocation. GET is never a generation trigger.
 *
 * The injected generator and authorization boundary must be trusted server code.
 * T5.3 adds canonical manifest/freshness and deep payload ownership validation;
 * T5.5 connects the actual Next Server Actions and Coach preview.
 */
export function createAuthorizedReviewSnapshotOperations(deps: OperationsDependencies) {
  async function authorizedScope(request: SnapshotRequest) {
    const decision = await deps.authorize(request)
    if (decision.kind !== 'authorized' ||
      decision.scope.groupTrainingPlanId !== request.groupTrainingPlanId) {
      return null
    }
    return decision.scope
  }

  return {
    async create(request: SnapshotRequest): Promise<
      | { readonly kind: 'created'; readonly snapshotId: string }
      | { readonly kind: 'denied' }
    > {
      // The CREATE entry point must not be called by rendering or GET.
      const scope = await authorizedScope({ groupTrainingPlanId: request.groupTrainingPlanId })
      if (!scope) return { kind: 'denied' }

      // Fail closed even when a legacy caller omitted the freshness dependency.
      // Type-level requiredness follows once all isolated fixtures supply it.
      if (!deps.readCurrentSourceManifest) {
        throw new Error('generation_stale: source freshness reader unavailable')
      }

      const generated = await deps.generate(scope)
      const generatedMicrocycleIds = assertGeneratedProposalCounts(generated, scope)

      // Generation may take long enough for the actor's H2 session, active H3
      // Team or H4A capability to change. Resolve fresh server authority and
      // reject any ownership drift before allocating durable review evidence.
      const refreshedScope = await authorizedScope({
        groupTrainingPlanId: request.groupTrainingPlanId,
      })
      if (!refreshedScope ||
        refreshedScope.userId !== scope.userId ||
        refreshedScope.teamId !== scope.teamId ||
        refreshedScope.groupTrainingPlanId !== scope.groupTrainingPlanId ||
        refreshedScope.groupId !== scope.groupId ||
        refreshedScope.planningCohortId !== scope.planningCohortId) {
        return { kind: 'denied' }
      }

      // Re-read after fresh authorization. The caller must still prove this
      // dependency obtains current, trusted SQL generation facts.
      const currentSourceManifest = await deps.readCurrentSourceManifest(refreshedScope)
      if (evaluateReviewSnapshotSourceFreshness(
        generated.sourceManifest, currentSourceManifest,
      ).kind !== 'current') {
        throw new Error('generation_stale: source facts changed during generation')
      }

      // A matching Sporting Group is insufficient: Base and Variant have
      // independent persisted microcycle ancestry. Never allocate a snapshot
      // whose prescriptions refer to another Plan or deleted planning records.
      if (!validateGeneratedMicrocycleLineageSqlite(deps.sqlite, {
        groupTrainingPlanId: refreshedScope.groupTrainingPlanId,
        microcycleIds: generatedMicrocycleIds,
      })) {
        throw new Error('Snapshot microcycle lineage does not belong to authorized Plan')
      }

      // Callers must not use client-provided IDs as authorization. The explicit
      // ID here supports isolated tests; the production caller must omit it.
      const snapshotId = request.snapshotId ?? (deps.createId?.() ?? randomUUID())
      if (typeof snapshotId !== 'string' || !snapshotId.trim()) {
        throw new Error('Snapshot requires a nonempty server identity')
      }

      createReviewSnapshotSqlite(deps.sqlite, {
        ...scope,
        id: snapshotId,
        ...generated,
      }, deps.now())

      return { kind: 'created', snapshotId }
    },

    async get(request: SnapshotRequest): Promise<
      | { readonly kind: 'available'; readonly snapshot: ReviewSnapshotRecord }
      | { readonly kind: 'unavailable' }
      | { readonly kind: 'denied' }
    > {
      if (!request.snapshotId) return { kind: 'unavailable' }
      const scope = await authorizedScope(request)
      if (!scope) return { kind: 'denied' }

      const snapshot = getActiveReviewSnapshotSqlite(deps.sqlite, {
        id: request.snapshotId,
        userId: scope.userId,
        teamId: scope.teamId,
        groupTrainingPlanId: scope.groupTrainingPlanId,
      }, deps.now())

      if (!snapshot) return { kind: 'unavailable' }
      if (snapshot.groupId !== scope.groupId ||
        snapshot.planningCohortId !== scope.planningCohortId) {
        return { kind: 'unavailable' }
      }
      return { kind: 'available', snapshot }
    },
  }
}
