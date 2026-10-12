import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'

const args = process.argv.slice(2)
const index = args.indexOf('--database')
const apply = args.includes('--apply')
if (index < 0 || !args[index + 1] || args.some(arg => arg.startsWith('--') && arg !== '--database' && arg !== '--apply')) {
  throw new Error('Usage: pn db:seed:acceptance:multiteam --database <copy.sqlite> [--apply]')
}
if (process.env.NODE_ENV === 'production' || process.env.CI === 'true') {
  throw new Error('Acceptance fixture is forbidden in production and CI')
}
const databasePath = resolve(args[index + 1])
const localPath = resolve('sqlite.db')
if (databasePath === localPath && process.env.KAN758_ALLOW_LOCAL !== '1') {
  throw new Error('Refusing sqlite.db: use an isolated copy first (local application needs explicit KAN758_ALLOW_LOCAL=1)')
}
if (!existsSync(databasePath)) throw new Error('Database must already exist')
const userId = 'accept_h4b_athlete'
const teamA = 'team_1'
const teamB = 'team_2'
const memberId = 'accept_kan758_member_coach_team_2'
const teamName = 'KAN-758 Acceptance Team 2'
const db = new Database(databasePath, { fileMustExist: true, readonly: !apply })
try {
  if (apply) db.pragma('foreign_keys = ON')
  const required = ['teams', 'users', 'external_identity_links', 'team_memberships', 'athlete_profiles']
  const tables = new Set((db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map(row => row.name))
  if (required.some(table => !tables.has(table))) throw new Error('Missing canonical fixture tables')
  if ((db.pragma('foreign_key_check') as unknown[]).length) throw new Error('Existing FK drift; refusing seed')
  const user = db.prepare('SELECT id,is_deleted,email FROM users WHERE id=?').get(userId) as { id: string; is_deleted: number; email: string } | undefined
  if (!user || user.is_deleted || user.email !== 'athlete@test.com') throw new Error('Expected existing H4B Athlete EPT user')
  const links = db.prepare('SELECT id,provider,subject,is_deleted FROM external_identity_links WHERE user_id=?').all(userId) as Array<{ id: string; provider: string; subject: string; is_deleted: number }>
  if (links.length !== 1 || links[0].id !== 'accept_h4b_link_athlete' || links[0].provider !== 'supabase' || links[0].subject !== '1579feb3-60b3-45eb-83f6-c8eb312cd4c8' || links[0].is_deleted) throw new Error('Existing EPT link mismatch')
  const now = new Date().toISOString()
  const oldTeam = db.prepare('SELECT id,is_deleted FROM teams WHERE id=?').get(teamA) as { id: string; is_deleted: number } | undefined
  if (!oldTeam || oldTeam.is_deleted) throw new Error('Missing original team_1')
  const currentTeam = db.prepare('SELECT id,name,description,is_deleted FROM teams WHERE id=?').get(teamB) as { id: string; name: string; description: string | null; is_deleted: number } | undefined
  if (currentTeam && (currentTeam.name !== teamName || currentTeam.description !== 'Isolated acceptance fixture KAN-758' || currentTeam.is_deleted)) throw new Error('team_2 collision')
  const memberships = db.prepare('SELECT id,team_id,preset,is_active,is_deleted,effective_from,effective_until FROM team_memberships WHERE user_id=?').all(userId) as Array<{ id: string; team_id: string; preset: string; is_active: number; is_deleted: number; effective_from: string; effective_until: string | null }>
  const athlete = memberships.find(row => row.id === 'accept_h4b_membership_athlete')
  if (!athlete || athlete.team_id !== teamA || athlete.preset !== 'athlete' || athlete.is_active !== 1 || athlete.is_deleted !== 0 || athlete.effective_from > now || athlete.effective_until !== null) throw new Error('Baseline athlete membership mismatch')
  const coach = memberships.find(row => row.id === memberId)
  if (coach && (coach.team_id !== teamB || coach.preset !== 'coach' || coach.is_active !== 1 || coach.is_deleted !== 0 || coach.effective_from > now || coach.effective_until !== null)) throw new Error('Coach membership collision')
  if (memberships.some(row => row.id !== athlete.id && row.id !== memberId)) throw new Error('Unexpected membership for acceptance actor')
  const otherTeamMembers = db.prepare('SELECT id,user_id FROM team_memberships WHERE team_id=?').all(teamB) as Array<{ id: string; user_id: string }>
  if (otherTeamMembers.some(row => row.id !== memberId || row.user_id !== userId)) throw new Error('Existing team_2 membership collision')
  const profiles = db.prepare('SELECT id,team_id FROM athlete_profiles WHERE user_id=?').all(userId) as Array<{ id: string; team_id: string }>
  if (profiles.length !== 1 || profiles[0].id !== 'accept_h4b_profile_athlete' || profiles[0].team_id !== teamA) throw new Error('AthleteProfile drift / team_2 profile prohibited')
  const unowned = db.prepare('SELECT id FROM team_memberships WHERE id=? AND user_id<>?').get(memberId,userId)
  if (unowned) throw new Error('Deterministic membership ID collision')
  const absentTeam = !currentTeam
  const absentMember = !coach
  if (absentTeam !== absentMember) throw new Error('Partial fixture state; refusing mutation')
  if (!apply) {
    console.log('KAN-758 DRY RUN: ' + (absentTeam ? 'ready to create team_2 and COACH membership' : 'already provisioned'))
  } else if (absentTeam) {
    db.transaction(() => {
      db.prepare('INSERT INTO teams (id,name,description,created_at,updated_at) VALUES (?,?,?,?,?)').run(teamB,teamName,'Isolated acceptance fixture KAN-758',now,now)
      db.prepare("INSERT INTO team_memberships(id,user_id,team_id,preset,effective_from,effective_until,is_active,created_at,updated_at) VALUES (?,?,?,'coach',?,NULL,1,?,?)").run(memberId,userId,teamB,now,now,now)
      if ((db.pragma('foreign_key_check') as unknown[]).length) throw new Error('FK violation; rollback')
    }).immediate()
    console.log('KAN-758 MULTITEAM: PASS')
  } else {
    console.log('KAN-758 MULTITEAM: PASS (idempotent no-op)')
  }
} finally {
  db.close()
}
