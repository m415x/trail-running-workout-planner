import type Database from 'better-sqlite3'

export interface AcceptanceAthleteBActor {
  userId: string
  profileId: string
  linkId: string
  membershipId: string
  subject: string
}

type Sqlite = Database.Database
type Row = Record<string, unknown>

const TEAM = 'team_1'

/**
 * Transactional persistence kernel for a disposable acceptance SQLite.
 * The production-schema adapter and environment guards belong to subsequent
 * integration cuts; do not call this kernel against operational sqlite.db.
 */
export function provisionAcceptanceAthleteB(input: {
  db: Sqlite
  actor: AcceptanceAthleteBActor
  apply: boolean
}): 'absent' | 'complete' | 'created' {
  const { db, actor, apply } = input
  if (!actor.subject.trim() || !actor.userId.trim() || !actor.profileId.trim()
    || !actor.linkId.trim() || !actor.membershipId.trim()
    || actor.userId === 'accept_h4b_athlete') {
    throw new Error('incompatible acceptance identity')
  }

  const team = db.prepare('SELECT id FROM teams WHERE id = ?').get(TEAM) as Row | undefined
  if (!team) throw new Error('incompatible Team precondition')

  const users = db.prepare('SELECT id FROM users WHERE id = ?').all(actor.userId) as Row[]
  const links = db.prepare('SELECT id, user_id, provider, subject FROM external_identity_links WHERE user_id = ? OR (provider = ? AND subject = ?) OR id = ?')
    .all(actor.userId, 'supabase', actor.subject, actor.linkId) as Row[]
  const memberships = db.prepare('SELECT id, user_id, team_id, preset, is_active FROM team_memberships WHERE user_id = ? OR id = ?')
    .all(actor.userId, actor.membershipId) as Row[]
  const profiles = db.prepare('SELECT id, user_id, team_id, group_id FROM athlete_profiles WHERE user_id = ? OR id = ?')
    .all(actor.userId, actor.profileId) as Row[]

  if (!users.length && !links.length && !memberships.length && !profiles.length) {
    if (!apply) return 'absent'
    db.transaction(() => {
      db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run(actor.userId, 'acceptance-athlete-b@invalid.example')
      db.prepare('INSERT INTO external_identity_links (id, user_id, provider, subject) VALUES (?, ?, ?, ?)')
        .run(actor.linkId, actor.userId, 'supabase', actor.subject)
      db.prepare('INSERT INTO team_memberships (id, user_id, team_id, preset, is_active) VALUES (?, ?, ?, ?, ?)')
        .run(actor.membershipId, actor.userId, TEAM, 'athlete', 1)
      db.prepare('INSERT INTO athlete_profiles (id, user_id, team_id, group_id) VALUES (?, ?, ?, NULL)')
        .run(actor.profileId, actor.userId, TEAM)
    })()
    return 'created'
  }

  const complete = users.length === 1 && users[0].id === actor.userId
    && links.length === 1 && links[0].id === actor.linkId
    && links[0].user_id === actor.userId && links[0].provider === 'supabase'
    && links[0].subject === actor.subject
    && memberships.length === 1 && memberships[0].id === actor.membershipId
    && memberships[0].user_id === actor.userId && memberships[0].team_id === TEAM
    && memberships[0].preset === 'athlete' && memberships[0].is_active === 1
    && profiles.length === 1 && profiles[0].id === actor.profileId
    && profiles[0].user_id === actor.userId && profiles[0].team_id === TEAM
    && profiles[0].group_id === null
  if (!complete) throw new Error('incompatible partial or colliding acceptance identity')
  return 'complete'
}
