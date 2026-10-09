import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'
import type { ManualRealizedTrainingClientInput } from '@/types/training/realized-training-capture.types'

type SelfResolution =
  | { status: 'denied' }
  | { status: 'resolved'; userId: string; teamId: string; athleteProfileId: string }

type EffectiveSessionResolution =
  | { status: 'denied' }
  | { status: 'resolved'; athleteProfileId: string; sessionId: string; prescriptionId: string }

export function createManualSelfCaptureBoundary<TRecord>(deps: {
  resolveSelf(
    access: RequireAuthenticatedActionResult,
    request: { at: string; capability: 'workout_log.self.manage' },
  ): Promise<SelfResolution>
  resolveEffectiveSession(
    access: RequireAuthenticatedActionResult,
    sessionId: string,
    at: string,
  ): Promise<EffectiveSessionResolution>
  persist(input: ManualRealizedTrainingClientInput & { athleteId: string }): TRecord
}) {
  return {
    async create(
      access: RequireAuthenticatedActionResult,
      input: ManualRealizedTrainingClientInput,
      at: string,
    ): Promise<{ success: false; error: string } | { success: true; data: TRecord }> {
      if (access.status !== 'authenticated') {
        return { success: false, error: 'Acceso no autorizado' }
      }

      try {
        const self = await deps.resolveSelf(access, {
          at,
          capability: 'workout_log.self.manage',
        })
        if (self.status !== 'resolved' || self.userId !== access.userId) {
          return { success: false, error: 'Acceso no autorizado' }
        }

        if (input.sessionId === null) {
          // Free evidence is valid, but an arbitrary client workout locator
          // cannot establish a persistent planning relationship.
          if (input.workoutId !== null) {
            return { success: false, error: 'invalid_workout_locator' }
          }
        } else {
          const session = await deps.resolveEffectiveSession(access, input.sessionId, at)
          if (
            session.status !== 'resolved'
            || session.athleteProfileId !== self.athleteProfileId
            || session.sessionId !== input.sessionId
          ) {
            return { success: false, error: 'Acceso no autorizado' }
          }
        }

        const data = deps.persist({ ...input, athleteId: self.athleteProfileId })
        return { success: true, data }
      } catch {
        return { success: false, error: 'realized_training_persistence_failed' }
      }
    },
  }
}
