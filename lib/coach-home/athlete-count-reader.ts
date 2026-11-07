export type CoachHomeAthleteCountContext =
  | { status: 'resolved'; actorId: string; teamId: string }
  | { status: 'denied' | 'selection_required' | 'invalid_context' | 'error' }

export type CoachHomeAthleteCountResult =
  | { status: 'ready' | 'empty'; count: number }
  | { status: 'denied' | 'selection_required' | 'invalid_context' | 'error' }

/**
 * The active Team and actor must be resolved by H2/H3 on the server.
 * H4A is checked before any athlete read; the repository returns an aggregate,
 * never a collection of athlete profiles or PII.
 */
export function createCoachHomeAthleteCountReader(deps: {
  resolveContext(): Promise<CoachHomeAthleteCountContext>
  authorize(context: Extract<CoachHomeAthleteCountContext, { status: 'resolved' }>): Promise<boolean>
  countActive(teamId: string): Promise<number>
}) {
  return {
    async read(): Promise<CoachHomeAthleteCountResult> {
      try {
        const context = await deps.resolveContext()
        if (context.status !== 'resolved') return { status: context.status }
        if (!(await deps.authorize(context))) return { status: 'denied' }
        const count = await deps.countActive(context.teamId)
        if (!Number.isSafeInteger(count) || count < 0) return { status: 'error' }
        return count === 0 ? { status: 'empty', count: 0 } : { status: 'ready', count }
      } catch {
        return { status: 'error' }
      }
    },
  }
}
