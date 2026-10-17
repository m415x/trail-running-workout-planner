import type postgres from 'postgres'
import { authorizeEffectiveCapability, type EffectiveTeamMembership } from '@/lib/authorization/effective-authorization'
import type { AthleteProfileLink } from '@/lib/authorization/scope-resolution'
import {
  selectCurrentSelfDeclaredBiometrics,
  type SelfDeclaredBiometricObservation,
  type SelfDeclaredBiometricKind,
} from './self-declared-biometric-selection'
import type { BiometricWriteSubject } from './biometric-self-writer'

type PgClient = ReturnType<typeof postgres>
type Cut = { readonly effectiveOn: string; readonly knownAt: string }
type Result =
  | { readonly status: 'denied' }
  | { readonly status: 'loaded'; readonly current: ReturnType<typeof selectCurrentSelfDeclaredBiometrics> }

/** Private SELF read: H2/active Team originates in the calling server boundary. */
export async function readCurrentSelfDeclaredBiometricsPostgres(
  client: PgClient,
  subject: BiometricWriteSubject,
  cut: Cut,
): Promise<Result> {
  if (subject.status !== 'resolved' || !subject.userId || !subject.teamId || !subject.athleteProfileId
    || !/^\d{4}-\d{2}-\d{2}$/.test(cut.effectiveOn)
    || !Number.isFinite(Date.parse(cut.knownAt))) return { status: 'denied' }

  return client.begin(async (tx: postgres.TransactionSql): Promise<Result> => {
    const memberships = await tx<{
      user_id: string; team_id: string; preset: EffectiveTeamMembership['preset'];
      effective_from: string; effective_until: string | null; is_active: boolean
    }[]>`SELECT user_id,team_id,preset,effective_from,effective_until,is_active
      FROM team_memberships WHERE user_id=${subject.userId}
      AND team_id=${subject.teamId} AND is_deleted=false FOR SHARE`
    const profiles = await tx<{ id: string; user_id: string | null; team_id: string }[]>`
      SELECT id,user_id,team_id FROM athlete_profiles
      WHERE user_id=${subject.userId} AND team_id=${subject.teamId}
      AND is_active=true AND is_deleted=false FOR SHARE`
    const allowed = authorizeEffectiveCapability({
      authenticatedUserId: subject.userId,
      teamId: subject.teamId,
      capability: 'physiology.biometric.self.read',
      resource: { teamId: subject.teamId, athleteProfileId: subject.athleteProfileId },
      at: new Date().toISOString(),
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

    const rows = await tx<{
      id: string; team_id: string; athlete_profile_id: string; kind: SelfDeclaredBiometricKind;
      value_scaled: number; observed_on: string; recorded_at: string;
      supersedes_observation_id: string | null; source: 'athlete_declared'
    }[]>`SELECT id,team_id,athlete_profile_id,kind,value_scaled,observed_on,
      recorded_at,supersedes_observation_id,source
      FROM athlete_biometric_observations
      WHERE team_id=${subject.teamId} AND athlete_profile_id=${subject.athleteProfileId}
      AND source='athlete_declared' AND recorded_at<=${cut.knownAt}`
    const observations: SelfDeclaredBiometricObservation[] = rows.map(row => ({
      id: row.id, teamId: row.team_id, athleteProfileId: row.athlete_profile_id,
      kind: row.kind, valueScaled: row.value_scaled, observedOn: row.observed_on,
      recordedAt: new Date(row.recorded_at).toISOString(),
      supersedesObservationId: row.supersedes_observation_id, source: row.source,
    }))
    return {
      status: 'loaded',
      current: selectCurrentSelfDeclaredBiometrics({
        observations, teamId: subject.teamId, athleteProfileId: subject.athleteProfileId,
        effectiveOn: cut.effectiveOn, knownAt: cut.knownAt,
      }),
    }
  })
}
