/**
 * KAN-790/T5.1 — fail-closed scope resolution for server-owned review snapshots.
 *
 * This pure boundary never accepts a client-supplied actor, Team or group.
 * Production adapters must supply fresh H2/H3/H4A evidence and SQL reads.
 * Resolving authority does not itself perform snapshot persistence.
 */
export interface ReviewPlanAuthority {
  readonly id: string
  readonly groupId: string
  readonly teamId: string
  readonly planningCohortId: string | null
}

export interface ReviewSnapshotIdentity {
  readonly id: string
  readonly userId: string
  readonly teamId: string
  readonly groupTrainingPlanId: string
  readonly groupId: string
  readonly planningCohortId: string | null
}

export interface AuthorizedReviewSnapshotScope {
  readonly userId: string
  readonly teamId: string
  readonly groupTrainingPlanId: string
  readonly groupId: string
  readonly planningCohortId: string | null
}

export interface ReviewSnapshotScopeDependencies {
  authenticate(): Promise<string | null>
  resolveActiveTeam(userId: string): Promise<string | null>
  readPlan(groupTrainingPlanId: string): Promise<ReviewPlanAuthority | null>
  authorizePlanning(userId: string, teamId: string, groupId: string): Promise<boolean>
  readSnapshot(id: string): Promise<ReviewSnapshotIdentity | null>
}

export type ReviewSnapshotScopeResult =
  | { readonly kind: 'authorized'; readonly scope: AuthorizedReviewSnapshotScope }
  | { readonly kind: 'denied' }

const denied: ReviewSnapshotScopeResult = { kind: 'denied' }

function validId(id: unknown): id is string {
  return typeof id === 'string' && id.trim().length > 0
}

export async function resolveAuthorizedReviewSnapshotScope(
  request: { readonly groupTrainingPlanId: string; readonly snapshotId?: string },
  dependencies: ReviewSnapshotScopeDependencies,
): Promise<ReviewSnapshotScopeResult> {
  if (!validId(request.groupTrainingPlanId)) return denied
  if (request.snapshotId !== undefined && !validId(request.snapshotId)) return denied

  const userId = await dependencies.authenticate()
  if (!validId(userId)) return denied

  const teamId = await dependencies.resolveActiveTeam(userId)
  if (!validId(teamId)) return denied

  const plan = await dependencies.readPlan(request.groupTrainingPlanId)
  if (!plan || plan.id !== request.groupTrainingPlanId ||
    !validId(plan.groupId) || plan.teamId !== teamId ||
    (plan.planningCohortId !== null && !validId(plan.planningCohortId))) {
    return denied
  }

  if (!await dependencies.authorizePlanning(userId, teamId, plan.groupId)) return denied

  const scope: AuthorizedReviewSnapshotScope = {
    userId,
    teamId,
    groupTrainingPlanId: plan.id,
    groupId: plan.groupId,
    planningCohortId: plan.planningCohortId,
  }

  if (request.snapshotId !== undefined) {
    const snapshot = await dependencies.readSnapshot(request.snapshotId)
    if (!snapshot || snapshot.id !== request.snapshotId ||
      snapshot.userId !== scope.userId ||
      snapshot.teamId !== scope.teamId ||
      snapshot.groupTrainingPlanId !== scope.groupTrainingPlanId ||
      snapshot.groupId !== scope.groupId ||
      snapshot.planningCohortId !== scope.planningCohortId) {
      return denied
    }
  }

  return { kind: 'authorized', scope }
}
