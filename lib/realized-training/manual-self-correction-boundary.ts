import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'
import type { ManualRealizedTrainingCorrectionClientInput } from '@/types/training/realized-training-correction.types'
import type { ManualRealizedTrainingCorrectionInput } from '@/types/training/realized-training-correction.types'

type SelfResolution =
  | { status: 'denied' }
  | { status: 'resolved'; userId: string; teamId: string; athleteProfileId: string }

type EffectiveSessionResolution =
  | { status: 'denied' }
  | { status: 'resolved'; athleteProfileId: string; sessionId: string }

/**
 * Authorizes correction before reaching the durable correction repository.
 * The repository additionally enforces WorkoutLog ownership and writes the
 * changed projection plus append-only audit entry in one SQLite transaction.
 */
export function createManualSelfCorrectionBoundary<TRecord>(deps: {
  resolveSelf(
    access: RequireAuthenticatedActionResult,
    request: { at: string; capability: 'workout_log.self.manage' },
  ): Promise<SelfResolution>
  resolveEffectiveSession(
    access: RequireAuthenticatedActionResult,
    sessionId: string,
    at: string,
  ): Promise<EffectiveSessionResolution>
  persist(input: ManualRealizedTrainingCorrectionInput): TRecord
}) {
  return {
    async correct(
      access: RequireAuthenticatedActionResult,
      input: ManualRealizedTrainingCorrectionClientInput,
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

        if (input.replacement.sessionId === null) {
          if (input.replacement.workoutId !== null) {
            return { success: false, error: 'invalid_workout_locator' }
          }
        } else {
          const session = await deps.resolveEffectiveSession(
            access,
            input.replacement.sessionId,
            at,
          )
          if (
            session.status !== 'resolved'
            || session.athleteProfileId !== self.athleteProfileId
            || session.sessionId !== input.replacement.sessionId
          ) {
            return { success: false, error: 'Acceso no autorizado' }
          }
        }

        const data = deps.persist({
          ...input,
          athleteId: self.athleteProfileId,
          correctedByUserId: self.userId,
        })
        return { success: true, data }
      } catch {
        return { success: false, error: 'realized_training_correction_failed' }
      }
    },
  }
}
