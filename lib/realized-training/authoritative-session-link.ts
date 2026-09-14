import type { ManualRealizedTrainingCaptureInput } from '@/types/training/realized-training-capture.types'

export interface RealizedTrainingAthleteScope {
  readonly id: string
  readonly teamId: string
  readonly isDeleted: boolean
}

export interface RealizedTrainingSessionLinkCandidate {
  readonly id: string
  readonly teamId: string
  readonly workoutId: string | null
  readonly isDeleted: boolean
}

export class InvalidRealizedTrainingSessionLinkError extends Error {
  readonly code = 'invalid_realized_training_session_link'

  constructor(readonly reason: 'athlete_not_found' | 'session_not_found' | 'cross_team_session') {
    super(`Realized training session link rejected: ${reason}`)
    this.name = 'InvalidRealizedTrainingSessionLinkError'
  }
}

/**
 * Resolves an explicit plan-real link without any date/title/metric heuristic.
 *
 * When a session is selected, its workout reference becomes authoritative and
 * replaces any client-provided workoutId. A free workout keeps its existing
 * optional workoutId and remains unlinked.
 */
export function resolveAuthoritativeSessionLink(input: {
  readonly capture: ManualRealizedTrainingCaptureInput
  readonly athlete: RealizedTrainingAthleteScope | null
  readonly session: RealizedTrainingSessionLinkCandidate | null
}): ManualRealizedTrainingCaptureInput {
  if (!input.athlete || input.athlete.isDeleted) {
    throw new InvalidRealizedTrainingSessionLinkError('athlete_not_found')
  }

  if (input.capture.sessionId === null) return input.capture

  if (!input.session || input.session.isDeleted || input.session.id !== input.capture.sessionId) {
    throw new InvalidRealizedTrainingSessionLinkError('session_not_found')
  }

  if (input.session.teamId !== input.athlete.teamId) {
    throw new InvalidRealizedTrainingSessionLinkError('cross_team_session')
  }

  return {
    ...input.capture,
    workoutId: input.session.workoutId,
  }
}
