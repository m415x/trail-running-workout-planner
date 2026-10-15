'use server'

/**
 * Retired multipart endpoint. Legacy callers must fail closed rather than
 * persisting caller-controlled proposals or explanations. Coach persistence
 * now requires server-issued snapshotId and transactional PG authorization.
 */
export interface PersistGeneratedSessionsState {
  error?: string
  success?: string
}

export async function persistGeneratedSessions(
  _previousState: PersistGeneratedSessionsState,
  _formData: FormData,
): Promise<PersistGeneratedSessionsState> {
  return { error: 'La persistencia anterior ya no está disponible. Creá una revisión autorizada.' }
}
