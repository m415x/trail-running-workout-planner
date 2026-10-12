import type { ActiveTeamContextResult } from '../authorization/active-team-context'
import type { TeamMembershipPreset } from '../../types'

type Access = { status: string; userId?: string }
type Membership = { userId: string; teamId: string; preset: TeamMembershipPreset; isActive: boolean; isDeleted: boolean; effectiveFrom: string; effectiveUntil: string | null }

export function resolveAudienceDestination(input: { access: Access; team: ActiveTeamContextResult; memberships: readonly Membership[]; at: string }): { status: 'athlete' | 'coach'; teamId: string } | { status: 'selection_required' | 'deny' } {
  if (input.access.status !== 'authenticated' || !input.access.userId) return { status: 'deny' }
  if (input.team.status === 'selection_required') return { status: 'selection_required' }
  if (input.team.status !== 'resolved') return { status: 'deny' }
  const matching = input.memberships.filter(row => row.userId === input.access.userId && row.teamId === input.team.teamId && row.isActive && !row.isDeleted && row.effectiveFrom <= input.at && (row.effectiveUntil === null || row.effectiveUntil > input.at))
  if (matching.length !== 1) return { status: 'deny' }
  const preset = matching[0]!.preset
  if (preset === 'athlete') return { status: 'athlete', teamId: input.team.teamId }
  if (preset === 'assistant' || preset === 'coach' || preset === 'admin') return { status: 'coach', teamId: input.team.teamId }
  return { status: 'deny' }
}
