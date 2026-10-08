export interface AuthorizedSessionMutationInput {
  existingGroupIds: readonly string[]
  resultingGroupIds: readonly string[]
  authorizeGroup(groupId: string): Promise<boolean>
  mutate(): void | Promise<void>
}

/** Reject incomplete coverage before invoking the persistence callback. */
export async function executeAuthorizedSessionMutation(
  input: AuthorizedSessionMutationInput,
): Promise<boolean> {
  const groupIds = [...new Set([...input.existingGroupIds, ...input.resultingGroupIds])]
  if (groupIds.length === 0 || groupIds.some(id => !id.trim())) return false
  const decisions = await Promise.all(groupIds.map(id => input.authorizeGroup(id)))
  if (!decisions.every(Boolean)) return false
  await input.mutate()
  return true
}
