import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'
import { resolveEffectiveSelfSession } from './effective-self-session'

type SelfIdentity = {
  status: 'resolved'
  userId: string
  teamId: string
  athleteProfileId: string
}
type SelfResult = SelfIdentity | { status: 'denied' }

type SessionEvidence = {
  athleteId: string
  athleteTeamId: string
  currentGroupId: string | null
  groupChanges: Parameters<typeof resolveEffectiveSelfSession>[0]['groupChanges']
  memberships: Parameters<typeof resolveEffectiveSelfSession>[0]['memberships']
  basePlans: Parameters<typeof resolveEffectiveSelfSession>[0]['basePlans']
  session: Parameters<typeof resolveEffectiveSelfSession>[0]['session']
  prescriptions: Parameters<typeof resolveEffectiveSelfSession>[0]['prescriptions']
}

export interface H5aEffectiveSessionDeps {
  resolveSelf(
    access: RequireAuthenticatedActionResult,
    request: { at: string; capability: 'planning.self.read' },
  ): Promise<SelfResult>
  loadSessionEvidence(
    self: SelfIdentity,
    sessionId: string,
  ): Promise<SessionEvidence | null>
}

/**
 * The selected session is a locator, never authority. Resolve authenticated
 * sporting SELF first and evaluate the persisted plan and prescription.
 */
export function createH5aEffectiveSessionBoundary(deps: H5aEffectiveSessionDeps) {
  return {
    async resolve(
      access: RequireAuthenticatedActionResult,
      request: { at: string; sessionId: string; prescriptionId?: string | null },
    ) {
      if (access.status !== 'authenticated' || !request.sessionId) {
        return { status: 'denied' as const }
      }

      try {
        const self = await deps.resolveSelf(access, {
          at: request.at,
          capability: 'planning.self.read',
        })
        if (self.status !== 'resolved' || self.userId !== access.userId) {
          return { status: 'denied' as const }
        }

        const evidence = await deps.loadSessionEvidence(self, request.sessionId)
        if (!evidence) return { status: 'denied' as const }

        return resolveEffectiveSelfSession({
          ...evidence,
          athleteProfileId: self.athleteProfileId,
          sessionId: request.sessionId,
          prescriptionId: request.prescriptionId,
        })
      } catch {
        return { status: 'denied' as const }
      }
    },
  }
}
