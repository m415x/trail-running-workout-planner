import type postgres from 'postgres'

import { resolveBiometricCivilToday } from './biometric-regional-civil-date'
import { resolveBiometricSelfAuthority, type BiometricSelfAuthority } from './biometric-self-next-server'
import { resolveAuthorizedBiometricTeamTimeZone } from './biometric-team-timezone-postgres'
import { createPersistedAuthorizedBiometricPostgresRepository } from './biometric-self-postgres-authorized-repository'
import {
  createBiometricSelfWriter,
  type BiometricCreateInput,
  type BiometricCorrectionInput,
} from './biometric-self-writer'

type PgClient = ReturnType<typeof postgres>

/**
 * Private composition boundary. Production callers supply only a trusted PG
 * connection; the default authority is authenticated H2 + active Team/H3 SELF.
 * Dependency injection is for internal tests, never client/request payloads.
 */
export function createInternalBiometricPostgresComposer(deps: {
  readonly sql: PgClient
  readonly resolveSelfAuthority?: () => Promise<BiometricSelfAuthority>
  readonly clock?: () => Date
}) {
  const clock = deps.clock ?? (() => new Date())
  const authorize = deps.resolveSelfAuthority ?? (() => resolveBiometricSelfAuthority('manage'))
  const repository = createPersistedAuthorizedBiometricPostgresRepository(
    deps.sql, () => clock().toISOString(),
  )

  async function execute(
    action: 'create' | 'correct',
    input: BiometricCreateInput | BiometricCorrectionInput,
  ) {
    // The writer never receives client Team, User, Profile or timeZone fields.
    // Resolve request authority first, then region from the authorized Team.
    const authority = await authorize()
    if (authority.status !== 'resolved') return { status: 'denied' as const }

    const regional = await resolveAuthorizedBiometricTeamTimeZone(deps.sql, authority.teamId)
    if (regional.status !== 'resolved') return { status: 'denied' as const }

    const today = resolveBiometricCivilToday(clock(), regional.timeZone)
    const writer = createBiometricSelfWriter({
      authorize: async () => authority,
      today: () => today,
      persist: (subject, validated) => repository.create(subject, validated),
      correct: (subject, validated) => repository.correct(subject, validated),
    })
    if (action === 'correct') return writer.correct(input as BiometricCorrectionInput)
    return writer.create(input as BiometricCreateInput)
  }

  return {
    create: (input: BiometricCreateInput) => execute('create', input),
    correct: (input: BiometricCorrectionInput) => execute('correct', input),
  }
}
