import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'

const path = resolve('sqlite.db')
if (!existsSync(path)) throw new Error('No local sqlite.db. Inventory is read-only and does not initialize databases.')
const db = new Database(path, { readonly: true, fileMustExist: true })

const actors = [
  ['ATHLETE', '1579feb3-60b3-45eb-83f6-c8eb312cd4c8'],
  ['ASSISTANT', 'd2764887-4301-4b15-982a-71ef47274e90'],
  ['COACH', '65375bd2-4a7a-4a00-bf41-d289ec1d54f5'],
  ['ADMIN', '4db66f1f-0ee7-4829-b69e-a52c951bd9a4'],
] as const

try {
  const tables = new Set((db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name:string}[]).map(row=>row.name))
  for (const name of ['teams','users','external_identity_links','team_memberships','athlete_profiles','athlete_groups']) {
    if (!tables.has(name)) throw new Error(`Missing expected table: ${name}; run normal migrations before provisioning`)
  }
  const teams = db.prepare('SELECT id FROM teams WHERE is_deleted = 0 ORDER BY id').all() as {id:string}[]
  const groups = db.prepare('SELECT id,team_id,category_code,level_code FROM athlete_groups WHERE is_deleted=0 AND is_active=1 ORDER BY id').all() as {id:string;team_id:string;category_code:string;level_code:string}[]
  const candidateUsers = ['accept_h4b_athlete','accept_h4b_assistant','accept_h4b_coach','accept_h4b_admin']
  const ept = db.prepare('SELECT id FROM users WHERE id = ?')
  const linked = db.prepare("SELECT id,user_id,is_deleted FROM external_identity_links WHERE provider = 'supabase' AND subject = ?")
  const membership = db.prepare('SELECT id,team_id,preset,is_active,is_deleted,effective_from,effective_until FROM team_memberships WHERE user_id = ?')
  const profiles = db.prepare('SELECT id,team_id,group_id,is_deleted FROM athlete_profiles WHERE user_id = ?')
  console.log(JSON.stringify({
    sqlitePath:path,
    teams:teams.map(t=>t.id),
    activeGroups:groups,
    actors:actors.map(([preset,subject],i)=>({
      preset,
      subject,
      proposedEptId:candidateUsers[i],
      proposedEptIdExists:Boolean(ept.get(candidateUsers[i])),
      existingSubjectLinks:linked.all(subject),
      proposedUserMemberships:membership.all(candidateUsers[i]),
      proposedUserProfiles:profiles.all(candidateUsers[i]),
    })),
  },null,2))
} finally {
  db.close()
}
