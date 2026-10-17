import { sqliteConnection } from '@/db'
import { resolveBiometricCivilToday } from './biometric-regional-civil-date'
import { resolveBiometricSelfAuthority } from './biometric-self-next-server'
import { createBiometricSelfWriter, type BiometricCreateInput } from './biometric-self-writer'
import { createPersistedAuthorizedBiometricSqliteRepository } from './biometric-self-sqlite-authorized-repository'

/**
 * Internal SQLite composition only; NOT a public Server Action.
 * H2/H3 request authority is resolved again on each call and the repository
 * independently rechecks persisted SELF membership/profile in its transaction.
 * This SQLite-only path must not be exposed before PostgreSQL parity.
 */
export async function createCurrentBiometricSqliteObservation(
  input: BiometricCreateInput,
  serverContext: { readonly timeZone: string },
) {
  // A trusted server composition must supply the authorized regional IANA zone.
  const today = resolveBiometricCivilToday(new Date(), serverContext.timeZone)
  const repository = createPersistedAuthorizedBiometricSqliteRepository(
    sqliteConnection,
    () => new Date().toISOString(),
  )
  const writer = createBiometricSelfWriter({
    authorize: () => resolveBiometricSelfAuthority('manage'),
    today: () => today,
    persist: async (subject, validated) => repository.create(subject, validated),
  })
  return writer.create(input)
}
