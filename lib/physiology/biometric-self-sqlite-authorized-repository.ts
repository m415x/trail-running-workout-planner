import type Database from 'better-sqlite3'

import { createBiometricSelfSqliteRepository } from './biometric-self-sqlite-repository'
import { createBiometricSqlitePersistedReauthorization } from './biometric-self-sqlite-reauthorization'

/**
 * SQLite-only authorized repository for request-scoped, server-resolved SELF.
 * The reauthorization adapter and writer share precisely the same connection;
 * the writer calls it synchronously INSIDE each transaction before any replay
 * lookup or mutation. No caller-provided authorization override is accepted.
 *
 * This factory is not a Server Action or an authorization substitute for H2/H3
 * active-Team resolution at the request boundary.
 */
export function createPersistedAuthorizedBiometricSqliteRepository(
  connection: Database.Database,
  now: () => string,
) {
  return createBiometricSelfSqliteRepository(connection, {
    reauthorizeInTransaction: createBiometricSqlitePersistedReauthorization(
      connection,
      now,
      'physiology.biometric.self.manage',
    ),
  })
}
