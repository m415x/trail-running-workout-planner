import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'

const databasePath = resolve('sqlite.db')
const apply = process.argv.includes('--apply')
if (process.argv.some(arg => arg.startsWith('--') && arg !== '--apply')) throw new Error('Only --apply is supported')
if (process.env.NODE_ENV === 'production' || process.env.CI === 'true' || process.env.SQLITE_SCENARIO_MODE) {
  throw new Error('Acceptance provisioning is forbidden in production, CI and SQLite scenarios')
}
if (!existsSync(databasePath)) throw new Error('Missing local sqlite.db; no database will be created')

const teamId = 'team_1'
const athleteGroupId = 'team_1_S2'
const actors = [
  { preset: 'athlete', userId: 'accept_h4b_athlete', subject: '1579feb3-60b3-45eb-83f6-c8eb312cd4c8', email: 'athlete@test.com', firstName: 'Acceptance', lastName: 'Athlete' },
  { preset: 'assistant', userId: 'accept_h4b_assistant', subject: 'd2764887-4301-4b15-982a-71ef47274e90', email: 'assistant@test.com', firstName: 'Acceptance', lastName: 'Assistant' },
  { preset: 'coach', userId: 'accept_h4b_coach', subject: '65375bd2-4a7a-4a00-bf41-d289ec1d54f5', email: 'coach@test.com', firstName: 'Acceptance', lastName: 'Coach' },
  { preset: 'admin', userId: 'accept_h4b_admin', subject: '6b6c6713-a0da-4854-8eba-46dcba22e8ac', email: 'admin@test.com', firstName: 'Acceptance', lastName: 'Admin' },
] as const

const sqlite = new Database(databasePath, { fileMustExist: true, readonly: !apply })
try {
  const required = ['teams', 'athlete_groups', 'users', 'external_identity_links', 'team_memberships', 'athlete_profiles']
  const tables = new Set((sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(row => row.name))
  for (const table of required) if (!tables.has(table)) throw new Error(`Missing canonical table: ${table}`)
  const team = sqlite.prepare('SELECT id FROM teams WHERE id=? AND is_deleted=0').get(teamId)
  const group = sqlite.prepare('SELECT id FROM athlete_groups WHERE id=? AND team_id=? AND is_active=1 AND is_deleted=0').get(athleteGroupId, teamId)
  if (!team || !group) throw new Error('Expected active team_1 and team_1_S2 must exist')

  type Existing = { id: string; is_deleted: number }
  const findUser = sqlite.prepare('SELECT id,is_deleted,email,user_name FROM users WHERE id=?')
  const findLink = sqlite.prepare('SELECT id,user_id,subject,is_deleted FROM external_identity_links WHERE provider=? AND subject=?')
  const findMembers = sqlite.prepare('SELECT id,user_id,team_id,preset,is_active,is_deleted,effective_from,effective_until FROM team_memberships WHERE user_id=?')
  const findProfiles = sqlite.prepare('SELECT id,user_id,team_id,group_id,is_deleted FROM athlete_profiles WHERE user_id=?')
  const conflicts = sqlite.prepare('SELECT id FROM users WHERE email=? OR user_name=?')

  const state = actors.map(actor => {
    const user = findUser.get(actor.userId) as (Existing & { email: string; user_name: string }) | undefined
    const link = findLink.get('supabase', actor.subject) as (Existing & { user_id: string }) | undefined
    const memberships = findMembers.all(actor.userId) as Array<Existing & {team_id:string;preset:string;is_active:number;effective_from:string;effective_until:string|null}>
    const profiles = findProfiles.all(actor.userId) as Array<Existing & {team_id:string;group_id:string|null}>
    const profileId = 'accept_h4b_profile_athlete'
    const expectedLinkId = `accept_h4b_link_${actor.preset}`
    const expectedMembershipId = `accept_h4b_membership_${actor.preset}`
    const username = `accept.h4b.${actor.preset}`
    const separateCollision = (conflicts.all(actor.email,username) as {id:string}[]).some(row=>row.id!==actor.userId)
    const otherLinks = sqlite.prepare('SELECT id,provider,subject FROM external_identity_links WHERE user_id=?').all(actor.userId) as {id:string;provider:string;subject:string}[]
    if (separateCollision || otherLinks.some(row=>row.id!==expectedLinkId || row.provider!=='supabase' || row.subject!==actor.subject)) {
      throw new Error(`Identity collision for ${actor.preset}`)
    }
    const none = !user && !link && memberships.length===0 && profiles.length===0
    const validUser = user?.is_deleted===0 && user.email===actor.email && user.user_name===username
    const validLink = link?.id===expectedLinkId && link.user_id===actor.userId && link.is_deleted===0
    const validMembership = memberships.length===1 && memberships[0]?.id===expectedMembershipId &&
      memberships[0].team_id===teamId && memberships[0].preset===actor.preset &&
      memberships[0].is_active===1 && memberships[0].is_deleted===0 &&
      memberships[0].effective_until===null && memberships[0].effective_from<=(new Date().toISOString())
    const validProfile = actor.preset==='athlete'
      ? profiles.length===1 && profiles[0]?.id===profileId && profiles[0].team_id===teamId &&
        profiles[0].group_id===athleteGroupId && profiles[0].is_deleted===0
      : profiles.length===0
    const complete = Boolean(validUser && validLink && validMembership && validProfile)
    if (!none && !complete) throw new Error(`Partial/drift state detected for ${actor.preset}; refusing mutation`)
    return { preset:actor.preset, userId:actor.userId, subject:actor.subject, status:none?'absent':'complete' }
  })
  const statuses = new Set(state.map(item=>item.status))
  if (statuses.size!==1) throw new Error('Mixed partial provisioning state; no write allowed')
  console.log(JSON.stringify({ databasePath, teamId, athleteGroupId, mode:apply?'apply':'dry-run', actors:state },null,2))
  if (!apply) {
    console.log('DRY RUN ONLY. To insert, take a local backup and rerun with --apply.')
  } else if (statuses.has('complete')) {
    console.log('PASS: all four actors already provisioned; no mutation')
  } else {
    const insertUser = sqlite.prepare('INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    const insertLink = sqlite.prepare("INSERT INTO external_identity_links(id,user_id,provider,subject,created_at,updated_at) VALUES (?,?,'supabase',?,?,?)")
    const insertMembership = sqlite.prepare('INSERT INTO team_memberships(id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)')
    const insertProfile = sqlite.prepare('INSERT INTO athlete_profiles(id,user_id,team_id,group_id,dni,first_name,last_name,contact_email,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    sqlite.transaction(()=>{
      const now = new Date().toISOString()
      for (const actor of actors) {
        insertUser.run(actor.userId,`accept.h4b.${actor.preset}`,actor.email,actor.firstName,actor.lastName,now,now)
        insertLink.run(`accept_h4b_link_${actor.preset}`,actor.userId,actor.subject,now,now)
        insertMembership.run(`accept_h4b_membership_${actor.preset}`,actor.userId,teamId,actor.preset,now,now,now)
        if (actor.preset==='athlete') insertProfile.run('accept_h4b_profile_athlete',actor.userId,teamId,athleteGroupId,'ACCEPT-H4B-ATHLETE',actor.firstName,actor.lastName,actor.email,now,now)
      }
    }).immediate()
    console.log('PASS: four independent local EPT identities provisioned atomically')
  }
} finally {
  sqlite.close()
}
