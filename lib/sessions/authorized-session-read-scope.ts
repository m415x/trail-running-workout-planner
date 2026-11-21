export interface AuthorizedSessionReadScopeInput {
  sessionId: string
  teamId: string
  /** Return null for missing or soft-deleted sessions. */
  findSessionTeam(sessionId: string): string | null | Promise<string | null>
  /** Include only active, non-deleted prescriptions. */
  findPrescriptionGroups(sessionId: string): string[] | Promise<string[]>
  /** Caller supplies server-owned H4A planning.manage authorization. */
  authorizeGroup(groupId: string): Promise<boolean>
}

/** Fail closed on missing/foreign Team, empty Group coverage or any H4A denial. */
export async function authorizeSessionReadScope(input: AuthorizedSessionReadScopeInput): Promise<boolean> {
  const actualTeamId = await input.findSessionTeam(input.sessionId)
  if (!actualTeamId || actualTeamId !== input.teamId) return false

  const groups = [...new Set(await input.findPrescriptionGroups(input.sessionId))]
  if (!groups.length || groups.some(groupId => !groupId.trim())) return false

  const decisions = await Promise.all(groups.map(groupId => input.authorizeGroup(groupId)))
  return decisions.every(Boolean)
}
