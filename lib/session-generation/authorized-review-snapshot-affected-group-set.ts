interface Actor {
  readonly userId: string
  readonly teamId: string
}

interface Group {
  readonly id: string
  readonly teamId: string
}

interface AffectedGroupAuthorizationDependencies {
  readonly ownerUserId: string
  readonly ownerTeamId: string
  readonly groupIds: readonly string[]
  readonly resolveActor: () => Promise<Actor | null>
  readonly readGroup: (groupId: string) => Promise<Group | null>
  readonly authorizeGroup: (actor: Actor, groupId: string) => Promise<boolean>
}

/**
 * Fail closed if the actor/Team changes, an affected group is outside the
 * owner Team, or any per-group H4A decision is denied. This checks the
 * preauthorized set; CAS reconciliation still performs the final read-set
 * verification on the same SQLite transaction connection.
 */
export async function authorizeReviewSnapshotAffectedGroupSet(
  dependencies: AffectedGroupAuthorizationDependencies,
): Promise<ReadonlySet<string> | null> {
  const actor = await dependencies.resolveActor()
  if (!actor || actor.userId !== dependencies.ownerUserId ||
    actor.teamId !== dependencies.ownerTeamId) return null

  const authorized = new Set<string>()
  for (const groupId of dependencies.groupIds) {
    if (typeof groupId !== 'string' || !groupId.trim()) return null
    if (authorized.has(groupId)) continue

    const group = await dependencies.readGroup(groupId)
    if (!group || group.id !== groupId ||
      group.teamId !== dependencies.ownerTeamId) return null
    if (!await dependencies.authorizeGroup(actor, groupId)) return null

    authorized.add(groupId)
  }

  return authorized
}
