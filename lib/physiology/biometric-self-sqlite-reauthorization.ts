import type Database from 'better-sqlite3'
import { authorizeEffectiveCapability, type EffectiveTeamMembership } from '@/lib/authorization/effective-authorization'
import type { AthleteProfileLink } from '@/lib/authorization/scope-resolution'
import type { BiometricWriteSubject } from './biometric-self-writer'

type MembershipRow = {
  user_id: string
  team_id: string
  preset: EffectiveTeamMembership['preset']
  effective_from: string
  effective_until: string | null
  is_active: number
}
type ProfileRow = { id: string; user_id: string | null; team_id: string }

export function createBiometricSqlitePersistedReauthorization(
  connection: Database.Database,
  now: () => string,
  capability: 'physiology.biometric.self.read' | 'physiology.biometric.self.manage',
): (subject: BiometricWriteSubject) => boolean {
  return (subject) => {
    try {
      const memberships = (connection.prepare(
        'SELECT user_id, team_id, preset, effective_from, effective_until, is_active FROM team_memberships WHERE user_id = ? AND team_id = ? AND is_deleted = 0',
      ).all(subject.userId, subject.teamId) as MembershipRow[]).map((row) => ({
        userId: row.user_id, teamId: row.team_id, preset: row.preset,
        effectiveFrom: row.effective_from, effectiveUntil: row.effective_until,
        isActive: row.is_active === 1,
      }))
      const athleteProfiles: AthleteProfileLink[] = (connection.prepare(
        'SELECT id, user_id, team_id FROM athlete_profiles WHERE user_id = ? AND team_id = ? AND is_active = 1 AND is_deleted = 0',
      ).all(subject.userId, subject.teamId) as ProfileRow[]).map((row) => ({
        id: row.id, userId: row.user_id, teamId: row.team_id,
      }))
      return authorizeEffectiveCapability({
        authenticatedUserId: subject.userId,
        teamId: subject.teamId,
        capability,
        resource: { teamId: subject.teamId, athleteProfileId: subject.athleteProfileId },
        at: now(),
        memberships,
        athleteProfiles,
        grants: [],
        requiredScope: 'self',
      }).allowed
    } catch {
      return false
    }
  }
}
