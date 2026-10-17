import { createHash, randomUUID } from 'node:crypto'
import type postgres from 'postgres'

import { authorizeEffectiveCapability, type EffectiveTeamMembership } from '@/lib/authorization/effective-authorization'
import type { AthleteProfileLink } from '@/lib/authorization/scope-resolution'
import type { BiometricWriteSubject, BiometricValidatedCreate } from './biometric-self-writer'

type PgClient = ReturnType<typeof postgres>
type Correction = BiometricValidatedCreate & {
  readonly supersedesObservationId: string
  readonly correctionReason: string
}
type Result =
  | { readonly status: 'created'; readonly id: string }
  | { readonly status: 'replayed'; readonly id: string }
  | { readonly status: 'conflict' }
  | { readonly status: 'denied' }

function digest(operation: 'create' | 'correct', subject: BiometricWriteSubject, input: BiometricValidatedCreate, correction?: Correction): string {
  return createHash('sha256').update(JSON.stringify([
    'biometric.' + operation + '.v1', subject.userId, subject.teamId, subject.athleteProfileId,
    input.operationKey, input.kind, input.valueScaled, input.unit, input.observedOn,
    correction?.supersedesObservationId ?? null,
    ...(correction ? [correction.correctionReason] : []),
  ])).digest('hex')
}

/**
 * PostgreSQL transactional SELF-only persistence. Authorization, operation-key
 * lookup and insertion use one pinned transaction, never an unrelated pool.
 * This is an internal repository, not a public Server Action. Session H2 and
 * active-Team selection must be verified independently before invoking it.
 */
export function createPersistedAuthorizedBiometricPostgresRepository(client: PgClient, now: () => string) {
  async function write(subject: BiometricWriteSubject, input: BiometricValidatedCreate, correction?: Correction): Promise<Result> {
    const requestDigest = digest(correction ? 'correct' : 'create', subject, input, correction)
    return client.begin(async (tx: postgres.TransactionSql): Promise<Result> => {
      // Serialize all writes for this SELF scope, including competing operation keys
      // and revision successors, across separate PostgreSQL connections.
      const key = JSON.stringify(['kan646-biometric', subject.teamId, subject.athleteProfileId])
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`
      const memberships = await tx<{
        user_id: string; team_id: string; preset: EffectiveTeamMembership['preset'];
        effective_from: string; effective_until: string | null; is_active: boolean
      }[]>`SELECT user_id,team_id,preset,effective_from,effective_until,is_active
        FROM team_memberships WHERE user_id=${subject.userId}
        AND team_id=${subject.teamId} AND is_deleted=false FOR UPDATE`
      const profiles = await tx<{ id: string; user_id: string | null; team_id: string }[]>`
        SELECT id,user_id,team_id FROM athlete_profiles
        WHERE user_id=${subject.userId} AND team_id=${subject.teamId}
          AND is_active=true AND is_deleted=false FOR UPDATE`
      const allowed = authorizeEffectiveCapability({
        authenticatedUserId: subject.userId,
        teamId: subject.teamId,
        capability: 'physiology.biometric.self.manage',
        resource: { teamId: subject.teamId, athleteProfileId: subject.athleteProfileId },
        at: now(),
        memberships: memberships.map(row => ({
          userId: row.user_id, teamId: row.team_id, preset: row.preset,
          effectiveFrom: row.effective_from, effectiveUntil: row.effective_until,
          isActive: row.is_active,
        })),
        athleteProfiles: profiles.map((row): AthleteProfileLink => ({
          id: row.id, userId: row.user_id, teamId: row.team_id,
        })),
        grants: [], requiredScope: 'self',
      }).allowed
      if (!allowed) return { status: 'denied' }

      const existing = await tx<{ id: string; request_digest: string }[]>`
        SELECT id,request_digest FROM athlete_biometric_observations
        WHERE team_id=${subject.teamId} AND athlete_profile_id=${subject.athleteProfileId}
          AND recorded_by_user_id=${subject.userId} AND operation_key=${input.operationKey}`
      if (existing.length) return existing[0].request_digest === requestDigest
        ? { status: 'replayed', id: existing[0].id } : { status: 'conflict' }

      if (correction) {
        if (!correction.supersedesObservationId || !correction.correctionReason?.trim()) {
          return { status: 'denied' }
        }
        const target = await tx<{ id: string }[]>`
          SELECT id FROM athlete_biometric_observations
          WHERE id=${correction.supersedesObservationId} AND team_id=${subject.teamId}
            AND athlete_profile_id=${subject.athleteProfileId} AND kind=${input.kind}
            AND source='athlete_declared' FOR UPDATE`
        if (target.length !== 1) return { status: 'denied' }
        const successors = await tx<{ id: string }[]>`
          SELECT id FROM athlete_biometric_observations
          WHERE supersedes_observation_id=${correction.supersedesObservationId}`
        if (successors.length) return { status: 'denied' }
      }

      const id = randomUUID()
      const supersedes = correction?.supersedesObservationId ?? null
      const reason = correction?.correctionReason ?? null
      await tx`
        INSERT INTO athlete_biometric_observations
          (id,team_id,athlete_profile_id,kind,value_scaled,unit,observed_on,
           recorded_at,recorded_by_user_id,source,supersedes_observation_id,
           operation_key,request_digest,correction_reason)
        VALUES (${id},${subject.teamId},${subject.athleteProfileId},
          ${input.kind},${input.valueScaled},${input.unit},${input.observedOn},
          ${new Date().toISOString()},${subject.userId},'athlete_declared',
          ${supersedes},${input.operationKey},${requestDigest},${reason})`
      return { status: 'created', id }
    })
  }
  return {
    create: (subject: BiometricWriteSubject, input: BiometricValidatedCreate) => write(subject, input),
    correct: (subject: BiometricWriteSubject, input: Correction) => write(subject, input, input),
  }
}
