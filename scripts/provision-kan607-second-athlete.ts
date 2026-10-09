import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'

const apply = process.argv.includes('--apply')
if (process.argv.some(arg => arg.startsWith('--') && arg !== '--apply')) throw new Error('Unsupported argument')
if (process.env.CI === 'true' || process.env.NODE_ENV === 'production' || process.env.SQLITE_SCENARIO_MODE) {
  throw new Error('Local acceptance provisioning only')
}
if (!existsSync('sqlite.db')) throw new Error('Local seeded SQLite database required')

const identity = {
  userId: 'accept_kan607_athlete_b',
  linkId: 'accept_kan607_link_athlete_b',
  memberId: 'accept_kan607_membership_athlete_b',
  profileId: 'accept_kan607_profile_athlete_b',
  subject: '4db66f1f-0ee7-4829-b69e-a52c951bd9a4',
  email: 'm415xs@gmail.com',
  userName: 'accept.kan607.athlete.b',
  teamId: 'team_1',
  groupId: 'team_1_S2',
} as const

const db = new Database('sqlite.db', { fileMustExist: true, readonly: !apply })
try {
  const scalar = (query: string, ...args: string[]) => db.prepare(query).get(...args)
  if (!scalar('SELECT id FROM teams WHERE id=? AND is_deleted=0', identity.teamId)) throw new Error('Missing Team')
  if (!scalar('SELECT id FROM athlete_groups WHERE id=? AND team_id=? AND is_deleted=0 AND is_active=1', identity.groupId, identity.teamId)) throw new Error('Missing Group')

  const user = scalar('SELECT * FROM users WHERE id=?', identity.userId)
  const link = scalar('SELECT * FROM external_identity_links WHERE id=?', identity.linkId)
  const member = scalar('SELECT * FROM team_memberships WHERE id=?', identity.memberId)
  const profile = scalar('SELECT * FROM athlete_profiles WHERE id=?', identity.profileId)

  const conflicts = [
    scalar('SELECT id FROM users WHERE (email=? OR user_name=?) AND id<>?', identity.email, identity.userName, identity.userId),
    scalar('SELECT id FROM external_identity_links WHERE provider=? AND subject=? AND id<>?', 'supabase', identity.subject, identity.linkId),
    scalar('SELECT id FROM external_identity_links WHERE user_id=? AND id<>?', identity.userId, identity.linkId),
    scalar('SELECT id FROM team_memberships WHERE user_id=? AND id<>?', identity.userId, identity.memberId),
    scalar('SELECT id FROM athlete_profiles WHERE user_id=? AND id<>?', identity.userId, identity.profileId),
  ]
  if (conflicts.some(Boolean)) throw new Error('Identity collision')

  const absent = !user && !link && !member && !profile
  const row = (value: unknown): Record<string, unknown> => (value ?? {}) as Record<string, unknown>
  const u = row(user), l = row(link), m = row(member), p = row(profile)
  const complete = Boolean(
    user && link && member && profile
    && u.email === identity.email && u.user_name === identity.userName && u.is_deleted === 0
    && l.user_id === identity.userId && l.provider === 'supabase' && l.subject === identity.subject && l.is_deleted === 0
    && m.user_id === identity.userId && m.team_id === identity.teamId && m.preset === 'athlete'
    && m.is_active === 1 && m.is_deleted === 0 && m.effective_until === null
    && typeof m.effective_from === 'string' && m.effective_from <= new Date().toISOString()
    && p.user_id === identity.userId && p.team_id === identity.teamId && p.group_id === identity.groupId
    && p.is_active === 1 && p.is_deleted === 0
  )
  if (!absent && !complete) throw new Error('Partial or drifted state')

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    status: absent ? 'absent' : 'complete',
    actor: { userId: identity.userId, profileId: identity.profileId, teamId: identity.teamId, groupId: identity.groupId },
  }, null, 2))
  if (!apply || complete) {
    console.log(complete ? 'PASS: already provisioned' : 'DRY RUN: no changes')
  } else {
    db.transaction(() => {
      const at = new Date().toISOString()
      db.prepare('INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
        .run(identity.userId, identity.userName, identity.email, 'Acceptance', 'Athlete B', at, at)
      db.prepare("INSERT INTO external_identity_links(id,user_id,provider,subject,created_at,updated_at) VALUES (?,?,'supabase',?,?,?)")
        .run(identity.linkId, identity.userId, identity.subject, at, at)
      db.prepare('INSERT INTO team_memberships(id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)')
        .run(identity.memberId, identity.userId, identity.teamId, 'athlete', at, at, at)
      db.prepare('INSERT INTO athlete_profiles(id,user_id,team_id,group_id,dni,first_name,last_name,contact_email,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(identity.profileId, identity.userId, identity.teamId, identity.groupId, 'ACCEPT-KAN607-B', 'Acceptance', 'Athlete B', identity.email, at, at)
    }).immediate()
    console.log('PASS: second Athlete provisioned')
  }
} finally {
  db.close()
}
