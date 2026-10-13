import { existsSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'

/**
 * Dedicated local acceptance provisioning. Supabase account is never created
 * here. --subject must be verified independently against Supabase Auth.
 */
function argument(flag: string): string | null {
  const index = process.argv.indexOf(flag)
  if (index < 0) return null
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`Missing ${flag} value`)
  return value
}

const apply = process.argv.includes('--apply')
const allowed = new Set(['--database', '--subject', '--apply'])
if (process.argv.slice(2).some((value, index, all) =>
  value.startsWith('--') && !allowed.has(value)
  || (!value.startsWith('--') && (index === 0 || !['--database', '--subject'].includes(all[index - 1] ?? '')))
)) throw new Error('Unsupported arguments')
if (process.env.NODE_ENV === 'production' || process.env.CI === 'true' || process.env.SQLITE_SCENARIO_MODE) {
  throw new Error('Acceptance provisioning forbidden in production, CI and SQLite scenarios')
}

const pathArg = argument('--database')
const subject = argument('--subject')
if (!pathArg || !subject || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subject)) {
  throw new Error('Explicit database and verified UUID subject required')
}
const databasePath = resolve(pathArg)
if (!existsSync(databasePath)) throw new Error('SQLite database missing; not creating a database')
if (realpathSync(databasePath) !== databasePath) throw new Error('Database path must be canonical and absolute')

const teamId = 'team_1'
const userId = 'accept_athlete_b'
const profileId = 'accept_profile_athlete_b'
const linkId = 'accept_link_athlete_b'
const membershipId = 'accept_membership_athlete_b'
const username = 'accept.h4b.athlete.b'
const email = 'accept-athlete-b@invalid.example'
const sqlite = new Database(databasePath, { fileMustExist: true, readonly: !apply })
try {
  sqlite.pragma('foreign_keys = ON')
  const required = ['teams', 'users', 'external_identity_links', 'team_memberships', 'athlete_profiles']
  const tables = new Set((sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map(row => row.name))
  if (required.some(table => !tables.has(table))) throw new Error('Canonical acceptance schema missing')
  if (!sqlite.prepare('SELECT id FROM teams WHERE id=? AND is_deleted=0').get(teamId)) throw new Error('Expected active team_1 missing')

  type Row = { id: string; user_id?: string; team_id?: string; provider?: string; subject?: string; preset?: string; group_id?: string | null; is_active?: number; is_deleted?: number; effective_until?: string | null; user_name?: string; email?: string }
  const users = sqlite.prepare('SELECT id,user_name,email,is_deleted FROM users WHERE id=? OR user_name=? OR email=?').all(userId, username, email) as Row[]
  const links = sqlite.prepare('SELECT id,user_id,provider,subject,is_deleted FROM external_identity_links WHERE id=? OR user_id=? OR (provider=? AND subject=?)').all(linkId, userId, 'supabase', subject) as Row[]
  const memberships = sqlite.prepare('SELECT id,user_id,team_id,preset,is_active,is_deleted,effective_until FROM team_memberships WHERE id=? OR user_id=?').all(membershipId, userId) as Row[]
  const profiles = sqlite.prepare('SELECT id,user_id,team_id,group_id,is_deleted FROM athlete_profiles WHERE id=? OR user_id=?').all(profileId, userId) as Row[]
  const absent = !users.length && !links.length && !memberships.length && !profiles.length
  const complete = users.length === 1 && users[0].id === userId && users[0].user_name === username && users[0].email === email && users[0].is_deleted === 0
    && links.length === 1 && links[0].id === linkId && links[0].user_id === userId && links[0].provider === 'supabase' && links[0].subject === subject && links[0].is_deleted === 0
    && memberships.length === 1 && memberships[0].id === membershipId && memberships[0].user_id === userId && memberships[0].team_id === teamId && memberships[0].preset === 'athlete' && memberships[0].is_active === 1 && memberships[0].is_deleted === 0 && memberships[0].effective_until === null
    && profiles.length === 1 && profiles[0].id === profileId && profiles[0].user_id === userId && profiles[0].team_id === teamId && profiles[0].group_id === null && profiles[0].is_deleted === 0
  if (!absent && !complete) throw new Error('Incompatible or partial identity; refusing mutation')
  if (!apply) {
    console.log(`Acceptance Athlete B dry run: ${complete ? 'complete' : 'absent'}; no writes`)
  } else if (complete) {
    console.log('Acceptance Athlete B complete; no writes')
  } else {
    sqlite.transaction(() => {
      // Repeat every collision check inside an immediate write transaction.
      const conflict = sqlite.prepare('SELECT id FROM users WHERE id=? OR user_name=? OR email=?').get(userId, username, email)
        || sqlite.prepare('SELECT id FROM external_identity_links WHERE id=? OR user_id=? OR (provider=? AND subject=?)').get(linkId, userId, 'supabase', subject)
        || sqlite.prepare('SELECT id FROM team_memberships WHERE id=? OR user_id=?').get(membershipId, userId)
        || sqlite.prepare('SELECT id FROM athlete_profiles WHERE id=? OR user_id=?').get(profileId, userId)
      if (conflict) throw new Error('Concurrent identity collision; refusing mutation')
      const now = new Date().toISOString()
      sqlite.prepare('INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
        .run(userId,username,email,'Acceptance','Athlete B',now,now)
      sqlite.prepare("INSERT INTO external_identity_links(id,user_id,provider,subject,created_at,updated_at) VALUES (?,?, 'supabase', ?, ?, ?)")
        .run(linkId,userId,subject,now,now)
      sqlite.prepare('INSERT INTO team_memberships(id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)')
        .run(membershipId,userId,teamId,'athlete',now,now,now)
      sqlite.prepare('INSERT INTO athlete_profiles(id,user_id,team_id,group_id,dni,first_name,last_name,contact_email,created_at,updated_at) VALUES (?,?,?,NULL,?,?,?,?,?,?)')
        .run(profileId,userId,teamId,'ACCEPT-H4B-ATHLETE-B','Acceptance','Athlete B',email,now,now)
    }).immediate()
    console.log('Acceptance Athlete B provisioned atomically; group_id null')
  }
} finally {
  sqlite.close()
}
