import type Database from 'better-sqlite3'

export interface AcceptanceH1ActorInput {
  sqlite: Database.Database
  subject: string
  teamId: string
}

/**
 * KAN-885/T2: verifies pre-existing EPT identity and Team membership only.
 * This is not Supabase authentication or an H4A authorization decision.
 * Never provisions or mutates identity records.
 */
export function assertAcceptanceH1Actor({
  sqlite,
  subject,
  teamId,
}: AcceptanceH1ActorInput): void {
  if (!subject?.trim() || !teamId?.trim()) {
    throw new Error('KAN-885: H1 actor subject and Team are required')
  }

  const actors = sqlite.prepare(`
    SELECT u.id AS userId
    FROM external_identity_links AS l
    JOIN users AS u ON u.id = l.user_id
    WHERE l.provider = 'supabase' AND l.subject = ?
      AND l.is_deleted = 0 AND u.is_deleted = 0
  `).all(subject) as Array<{ userId: string }>

  if (actors.length !== 1) {
    throw new Error('KAN-885: H1 accredited Supabase identity link is missing or ambiguous')
  }

  const memberships = sqlite.prepare(`
    SELECT team_id AS teamId, preset, is_active AS isActive,
      effective_from AS effectiveFrom, effective_until AS effectiveUntil
    FROM team_memberships
    WHERE user_id = ? AND team_id = ? AND is_deleted = 0
  `).all(actors[0].userId, teamId) as Array<{
    teamId: string
    preset: string
    isActive: number
    effectiveFrom: string
    effectiveUntil: string | null
  }>

  const now = new Date().toISOString()
  const active = memberships.filter(row =>
    row.teamId === teamId
    && row.isActive === 1
    && Boolean(row.preset)
    && row.effectiveFrom <= now
    && (row.effectiveUntil === null || row.effectiveUntil > now),
  )
  if (active.length !== 1) {
    throw new Error('KAN-885: H1 active Team membership is absent or ambiguous')
  }
}
