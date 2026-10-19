import { sqliteConnection } from '@/db'
import { resolveBiometricCivilToday } from './biometric-regional-civil-date'
import { resolveBiometricSelfAuthority } from './biometric-self-next-server'
import { createBiometricSelfWriter, type BiometricCreateInput, type BiometricCorrectionInput } from './biometric-self-writer'
import { createPersistedAuthorizedBiometricSqliteRepository } from './biometric-self-sqlite-authorized-repository'

/**
 * Internal-only SELF writer. Both date validation and transaction-local
 * persistence use Team IANA authority from SQLite, never caller input.
 * Request H2/H3 is resolved per operation; the repository reauthorizes
 * persisted membership and profile inside the write transaction.
 */
async function buildCurrentBiometricSqliteWriter() {
  const repository = createPersistedAuthorizedBiometricSqliteRepository(
    sqliteConnection,
    () => new Date().toISOString(),
  )
  let today: string | null = null
  const writer = createBiometricSelfWriter({
    authorize: async () => {
      const subject = await resolveBiometricSelfAuthority('manage')
      if (subject.status !== 'resolved') return { status: 'denied' as const }
      const team = sqliteConnection.prepare(
        'SELECT time_zone FROM teams WHERE id = ? AND is_deleted = 0',
      ).get(subject.teamId) as { time_zone: string | null } | undefined
      const timeZone = team?.time_zone
      if (!timeZone || timeZone !== timeZone.trim()) return { status: 'denied' as const }
      try {
        today = resolveBiometricCivilToday(new Date(), timeZone)
      } catch {
        return { status: 'denied' as const }
      }
      return subject
    },
    today: () => today ?? '',
    persist: async (subject, validated) => repository.create(subject, validated),
    correct: async (subject, validated) => repository.correct(subject, validated),
  })
  return writer
}

export async function createCurrentBiometricSqliteObservation(input: BiometricCreateInput) {
  return (await buildCurrentBiometricSqliteWriter()).create(input)
}

export async function correctCurrentBiometricSqliteObservation(input: BiometricCorrectionInput) {
  return (await buildCurrentBiometricSqliteWriter()).correct(input)
}
