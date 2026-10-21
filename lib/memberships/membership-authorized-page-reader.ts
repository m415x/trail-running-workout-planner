import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'
import type { ActiveTeamContextResult } from '@/lib/authorization/active-team-context'

type Locale = 'es' | 'en'
type MembershipReadRequest<TDatabase> = { db: TDatabase; locale: Locale; onDate: string }
type ReadResult<T> =
  | { status: 'selection_required' | 'invalid_context' | 'denied' | 'error' }
  | { status: 'empty' | 'ready'; model: T; teamId: string }

/**
 * H2/H3/H4A-owned boundary. The projector never receives a client-controlled Team.
 * Keep presentation/projection logic inside createMembershipPageLoader.
 */
export function createMembershipAuthorizedPageReader<TDatabase, TModel>(deps: {
  authenticate(): Promise<RequireAuthenticatedActionResult>
  resolveActiveTeam(userId: string): Promise<ActiveTeamContextResult>
  authorize(access: RequireAuthenticatedActionResult, teamId: string, at: string): Promise<{ allowed: boolean }>
  load(input: MembershipReadRequest<TDatabase> & { teamId: string }): Promise<TModel>
  hasData(model: TModel): boolean
}) {
  return async function read(input: MembershipReadRequest<TDatabase>): Promise<ReadResult<TModel>> {
    try {
      const access = await deps.authenticate()
      if (access.status !== 'authenticated') return { status: 'denied' }
      const activeTeam = await deps.resolveActiveTeam(access.userId)
      if (activeTeam.status === 'selection_required') return { status: 'selection_required' }
      if (activeTeam.status === 'invalid_context') return { status: 'invalid_context' }
      if (activeTeam.status !== 'resolved') return { status: 'denied' }
      const decision = await deps.authorize(access, activeTeam.teamId, new Date().toISOString())
      if (!decision.allowed) return { status: 'denied' }
      const model = await deps.load({ ...input, teamId: activeTeam.teamId })
      return { status: deps.hasData(model) ? 'ready' : 'empty', model, teamId: activeTeam.teamId }
    } catch {
      return { status: 'error' }
    }
  }
}
