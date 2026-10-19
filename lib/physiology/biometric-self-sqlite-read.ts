import { sqliteConnection } from '@/db'
import { resolveBiometricSelfAuthority } from './biometric-self-next-server'
import { createBiometricSqlitePersistedReauthorization } from './biometric-self-sqlite-reauthorization'
import { resolveBiometricCivilToday } from './biometric-regional-civil-date'
import {
  selectCurrentSelfDeclaredBiometrics,
  type SelfDeclaredBiometricObservation,
  type SelfDeclaredBiometricKind,
} from './self-declared-biometric-selection'

export async function readCurrentSelfDeclaredBiometricsSqlite() {
  const subject = await resolveBiometricSelfAuthority('read')
  if (subject.status !== 'resolved') return { status: 'denied' as const }
  try {
    return sqliteConnection.transaction(() => {
      const authorize = createBiometricSqlitePersistedReauthorization(
        sqliteConnection, () => new Date().toISOString(), 'physiology.biometric.self.read',
      )
      if (!authorize(subject)) return { status: 'denied' as const }
      const team = sqliteConnection.prepare(
        'SELECT time_zone FROM teams WHERE id = ? AND is_deleted = 0',
      ).get(subject.teamId) as { time_zone: string | null } | undefined
      if (!team?.time_zone || team.time_zone !== team.time_zone.trim()) return { status: 'denied' as const }
      const instant = new Date()
      const effectiveOn = resolveBiometricCivilToday(instant, team.time_zone)
      const knownAt = instant.toISOString()
      const rows = sqliteConnection.prepare(`
        SELECT id,team_id,athlete_profile_id,kind,value_scaled,observed_on,
          recorded_at,supersedes_observation_id,source,observed_time_zone
        FROM athlete_biometric_observations
        WHERE team_id=? AND athlete_profile_id=? AND source='athlete_declared'
          AND recorded_at<=?
      `).all(subject.teamId, subject.athleteProfileId, knownAt) as Array<{
        id: string; team_id: string; athlete_profile_id: string;
        kind: SelfDeclaredBiometricKind; value_scaled: number; observed_on: string;
        recorded_at: string; supersedes_observation_id: string | null;
        source: 'athlete_declared'; observed_time_zone: string | null
      }>
      const observations: SelfDeclaredBiometricObservation[] = rows.map(row => ({
        id: row.id, teamId: row.team_id, athleteProfileId: row.athlete_profile_id,
        kind: row.kind, valueScaled: row.value_scaled, observedOn: row.observed_on,
        recordedAt: row.recorded_at, supersedesObservationId: row.supersedes_observation_id,
        source: row.source,
      }))
      const current = selectCurrentSelfDeclaredBiometrics({
        observations, teamId: subject.teamId, athleteProfileId: subject.athleteProfileId,
        effectiveOn, knownAt,
      })
      const project = (value: SelfDeclaredBiometricObservation | null) => {
        if (!value) return null
        const row = rows.find(entry => entry.id === value.id)
        return {
          id: value.id, valueScaled: value.valueScaled,
          observedOn: value.observedOn, recordedAt: value.recordedAt,
          observedTimeZone: row?.observed_time_zone ?? null,
        }
      }
      return {
        status: 'loaded' as const, effectiveOn,
        biometrics: {
          weight: project(current.weight),
          height: project(current.height),
          maxHr: project(current.maxHr),
          restHr: project(current.restHr),
        },
      }
    })()
  } catch {
    return { status: 'error' as const }
  }
}
