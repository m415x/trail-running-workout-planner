import { createHash, randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'

import { athleteBiometricObservations } from '@/db/athlete-biometric-observation-schema'
import type {
  BiometricValidatedCreate,
  BiometricWriteSubject,
} from '@/lib/physiology/biometric-self-writer'

// Schema reference keeps the persistence contract aligned with the Drizzle definition.
// The repository takes an isolated SQLite connection; it never imports the global db.
void athleteBiometricObservations

interface StoredOperation {
  id: string
  request_digest: string
}

export interface BiometricValidatedCorrection extends BiometricValidatedCreate {
  readonly supersedesObservationId: string
  readonly correctionReason: string
}

export type BiometricSqliteCreateResult =
  | { readonly status: 'created'; readonly id: string }
  | { readonly status: 'replayed'; readonly id: string }
  | { readonly status: 'conflict' }

function digestCreate(subject: BiometricWriteSubject, input: BiometricValidatedCreate): string {
  // Canonical field order, stable integers and explicit subject binding.
  const canonical = JSON.stringify([
    'biometric.create.v1', subject.userId, subject.teamId, subject.athleteProfileId,
    input.operationKey, input.kind, input.valueScaled, input.unit, input.observedOn,
    null, // supersedesObservationId: CREATE only, no correction on this boundary.
  ])
  return createHash('sha256').update(canonical).digest('hex')
}

/**
 * Isolated first-stage SQLite CREATE/correction persistence primitive.
 *
 * This module is NOT wired to a Server Action. In particular, the accepted
 * SELF subject must eventually be revalidated inside an authorized transaction
 * boundary before exposing mutations. Complete correction validation at the
 * authenticated entry boundary and PG parity remain separate T5 cuts.
 */
export interface BiometricSqliteRepositoryOptions {
  /** Synchronous, transaction-local authority check; required at the public writer integration boundary. */
  readonly reauthorizeInTransaction: (subject: BiometricWriteSubject) => boolean
}

export function createBiometricSelfSqliteRepository(connection: Database.Database, options?: BiometricSqliteRepositoryOptions) {
  if (typeof options?.reauthorizeInTransaction !== 'function') {
    throw new Error('Biometric SQLite repository requires transaction-local reauthorization')
  }
  const reauthorizeInTransaction = options.reauthorizeInTransaction
  return {
    correct(subject: BiometricWriteSubject, input: BiometricValidatedCorrection): BiometricSqliteCreateResult | { readonly status: 'denied' } {
      const requestDigest = createHash('sha256').update(JSON.stringify([
        'biometric.correct.v1', subject.userId, subject.teamId, subject.athleteProfileId,
        input.operationKey, input.kind, input.valueScaled, input.unit, input.observedOn,
        input.supersedesObservationId, input.correctionReason,
      ])).digest('hex')
      return connection.transaction(() => {
        if (!reauthorizeInTransaction(subject)) {
          return { status: 'denied' as const }
        }
        const existing = connection.prepare(
          `SELECT id, request_digest FROM athlete_biometric_observations
           WHERE team_id = ? AND athlete_profile_id = ?
             AND recorded_by_user_id = ? AND operation_key = ?`,
        ).get(subject.teamId, subject.athleteProfileId, subject.userId, input.operationKey) as StoredOperation | undefined

        if (existing) {
          return existing.request_digest === requestDigest
            ? { status: 'replayed' as const, id: existing.id }
            : { status: 'conflict' as const }
        }

        if (!input.supersedesObservationId || !input.correctionReason?.trim()) {
          return { status: 'denied' as const }
        }
        const target = connection.prepare(
          `SELECT id FROM athlete_biometric_observations
           WHERE id = ? AND team_id = ? AND athlete_profile_id = ?
             AND kind = ? AND source = 'athlete_declared'`,
        ).get(input.supersedesObservationId, subject.teamId, subject.athleteProfileId, input.kind)
        if (!target) return { status: 'denied' as const }

        const successor = connection.prepare(
          'SELECT id FROM athlete_biometric_observations WHERE supersedes_observation_id = ?',
        ).get(input.supersedesObservationId)
        if (successor) return { status: 'denied' as const }

        const id = randomUUID()
        connection.prepare(
          `INSERT INTO athlete_biometric_observations
             (id, team_id, athlete_profile_id, kind, value_scaled, unit,
              observed_on, recorded_at, recorded_by_user_id, source,
              supersedes_observation_id, operation_key, request_digest, correction_reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'athlete_declared', ?, ?, ?, ?)`,
        ).run(
          id, subject.teamId, subject.athleteProfileId, input.kind, input.valueScaled,
          input.unit, input.observedOn, new Date().toISOString(), subject.userId,
          input.supersedesObservationId, input.operationKey, requestDigest, input.correctionReason,
        )
        return { status: 'created' as const, id }
      })()
    },
    create(subject: BiometricWriteSubject, input: BiometricValidatedCreate): BiometricSqliteCreateResult | { readonly status: 'denied' } {
      const requestDigest = digestCreate(subject, input)
      return connection.transaction((): BiometricSqliteCreateResult | { readonly status: 'denied' } => {
        if (!reauthorizeInTransaction(subject)) {
          return { status: 'denied' }
        }
        const existing = connection.prepare(
          `SELECT id, request_digest FROM athlete_biometric_observations
           WHERE team_id = ? AND athlete_profile_id = ?
             AND recorded_by_user_id = ? AND operation_key = ?`,
        ).get(subject.teamId, subject.athleteProfileId, subject.userId, input.operationKey) as StoredOperation | undefined

        if (existing) {
          return existing.request_digest === requestDigest
            ? { status: 'replayed', id: existing.id }
            : { status: 'conflict' }
        }

        const id = randomUUID()
        const recordedAt = new Date().toISOString()
        // No client-controlled subject, author, timestamp, revision or source.
        const supersedesObservationId: null = null
        connection.prepare(
          `INSERT INTO athlete_biometric_observations
             (id, team_id, athlete_profile_id, kind, value_scaled, unit,
              observed_on, recorded_at, recorded_by_user_id, source,
              supersedes_observation_id, operation_key, request_digest, correction_reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'athlete_declared', ?, ?, ?, NULL)`,
        ).run(
          id, subject.teamId, subject.athleteProfileId, input.kind, input.valueScaled,
          input.unit, input.observedOn, recordedAt, subject.userId,
          supersedesObservationId, input.operationKey, requestDigest,
        )
        return { status: 'created', id }
      })()
    },
  }
}
