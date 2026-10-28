import assert from 'node:assert/strict'
import { config } from 'dotenv'
import { existsSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, resolve, sep } from 'node:path'
import Database from 'better-sqlite3'
import { resolveKan791AcceptanceIdentity } from '@/lib/auth/kan-791-acceptance-identity'
import { verifyKan791SupabaseIdentity } from '@/lib/auth/kan-791-supabase-identity-verification'

config({ path: resolve(import.meta.dirname, '../.env.local') })

const mode = process.argv[2]
assert.ok(mode === 'verify' || mode === 'apply', 'Usage: script verify|apply')
assert.notEqual(process.env.NODE_ENV, 'production')
assert.notEqual(process.env.CI, 'true')
assert.equal(process.env.SQLITE_SCENARIO_MODE, '1')
assert.equal(process.env.SQLITE_SEED_DISPOSABLE_ACK, '1')
const source = process.env.SQLITE_DATABASE_PATH
assert.ok(source, 'Explicit SQLITE_DATABASE_PATH required')
assert.ok(existsSync(source), 'Disposable SQLite must already exist')
const path = realpathSync(source)
const parent = realpathSync(dirname(path))
const tempRoot = realpathSync(tmpdir())
const canonical = (s: string) => process.platform === 'win32' ? s.toLowerCase() : s
assert.ok(canonical(parent).startsWith(canonical(tempRoot) + sep), 'Destination outside system temp')
assert.ok(basename(parent).startsWith('trail-running-sqlite-base-seed-kan855-'), 'Wrong KAN-855 disposable workspace')
assert.notEqual(canonical(path), canonical(resolve(import.meta.dirname, '../sqlite.db')), 'Developer DB forbidden')

const identity = resolveKan791AcceptanceIdentity({
  email: process.env.KAN791_AUTH_TEST_EMAIL ?? '',
  subject: process.env.KAN791_AUTH_SUBJECT ?? '',
})
const USER = 'kan855-ssr-authenticated-coach'
const LINK = 'kan855-ssr-authenticated-link'
const MEMBER = 'kan855-ssr-authenticated-membership'
const TEAM = 'team_1'

type User = {id:string; email:string;user_name:string;is_deleted:number}
type Link = {id:string;user_id:string;provider:string;subject:string;is_deleted:number}
type Membership = {id:string;user_id:string;team_id:string;preset:string;is_active:number;is_deleted:number;effective_from:string;effective_until:string|null}

async function main() {
  // Verify the actual authenticated Supabase user before opening SQLite for a mutation.
  await verifyKan791SupabaseIdentity(identity)
  const db = new Database(path, { readonly: mode === 'verify', fileMustExist: true })
  try {
    db.pragma('foreign_keys = ON')
    const inspect = () => {
      const team = db.prepare('SELECT id FROM teams WHERE id=? AND is_deleted=0').get(TEAM)
      assert.ok(team, 'Target Team absent or inactive')
      const users = db.prepare('SELECT id,email,user_name,is_deleted FROM users WHERE id=? OR email=? OR user_name=?').all(USER,identity.email,USER) as User[]
      const links = db.prepare("SELECT id,user_id,provider,subject,is_deleted FROM external_identity_links WHERE id=? OR user_id=? OR (provider='supabase' AND subject=?)").all(LINK,USER,identity.subject) as Link[]
      const members = db.prepare('SELECT id,user_id,team_id,preset,is_active,is_deleted,effective_from,effective_until FROM team_memberships WHERE id=? OR user_id=?').all(MEMBER,USER) as Membership[]
      const absent = users.length===0 && links.length===0 && members.length===0
      const u=users[0], l=links[0], m=members[0]
      const complete=users.length===1 && links.length===1 && members.length===1 &&
        u?.id===USER && u.email===identity.email && u.user_name===USER && u.is_deleted===0 &&
        l?.id===LINK && l.user_id===USER && l.provider==='supabase' && l.subject===identity.subject && l.is_deleted===0 &&
        m?.id===MEMBER && m.user_id===USER && m.team_id===TEAM && m.preset==='coach' &&
        m.is_active===1 && m.is_deleted===0 && m.effective_until===null && m.effective_from<=new Date().toISOString()
      assert.ok(absent || complete,'Conflicting or partially provisioned identity; fail closed')
      return absent?'absent':'complete'
    }
    const initial=inspect()
    if (mode==='verify' || initial==='complete') {
      console.log(JSON.stringify({mode,status:initial,verifiedSupabaseIdentity:true,team:TEAM,mutated:false}))
      return
    }
    db.transaction(()=>{
      assert.equal(inspect(),'absent','Identity changed before mutation')
      const now=new Date().toISOString()
      db.prepare('INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(USER,USER,identity.email,'KAN855','Acceptance',now,now)
      db.prepare("INSERT INTO external_identity_links(id,user_id,provider,subject,created_at,updated_at) VALUES (?,?,'supabase',?,?,?)").run(LINK,USER,identity.subject,now,now)
      db.prepare('INSERT INTO team_memberships(id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)').run(MEMBER,USER,TEAM,'coach',now,now,now)
      assert.equal(inspect(),'complete')
      assert.equal((db.pragma('foreign_key_check') as unknown[]).length,0)
    }).immediate()
    console.log(JSON.stringify({mode,status:'complete',verifiedSupabaseIdentity:true,team:TEAM,mutated:true}))
  } finally {db.close()}
}
main().catch(e=>{console.error('KAN-855 provision DENY: '+(e instanceof Error?e.message:'unknown'));process.exitCode=1})
