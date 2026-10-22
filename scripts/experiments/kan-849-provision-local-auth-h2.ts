import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, realpathSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import Database from 'better-sqlite3'
import { createClient } from '@supabase/supabase-js'

async function main(): Promise<void> {
  const root = process.cwd()
  assert.ok(root.toLowerCase().endsWith('trail-running-workout-planner-kan-849-exp'), 'Experimental worktree required')
  assert.notEqual(process.env.NODE_ENV, 'production')
  assert.notEqual(process.env.CI, 'true')
  const locator = resolve('.tmp/kan-849-acceptance-db-path.txt')
  const dbPath = realpathSync(readFileSync(locator, 'utf8').trim())
  assert.notEqual(dbPath.toLowerCase(), resolve('sqlite.db').toLowerCase())
  assert.ok(realpathSync(dirname(dbPath)).toLowerCase().includes('trail-running-sqlite-base-seed-'), 'Accredited disposable SQLite required')
  const api = 'http://127.0.0.1:54321'
  const key = process.env.KAN849_LOCAL_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!key?.startsWith('sb_publishable_')) throw new Error('Set KAN849_LOCAL_SUPABASE_PUBLISHABLE_KEY using LOCAL CLI status; no production credentials')
  const email = 'kan849-' + randomBytes(6).toString('hex') + '@example.test'
  const password = randomBytes(28).toString('base64url') + 'A1!'
  const client = createClient(api, key, {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  const { data, error } = await client.auth.signUp({ email, password })
  if (error || !data.user?.id) throw error ?? new Error('Local Auth user creation failed')
  if (!data.session) throw new Error('Local Auth email confirmation prevents immediately verified login; configure LOCAL auth test signup policy, never bypass product H2')
  const claims = await client.auth.getClaims()
  const user = await client.auth.getUser()
  assert.ok(!claims.error && !user.error && user.data.user?.id === data.user.id && claims.data?.claims?.sub === data.user.id, 'Verified subject must match local Auth user')
  const sqlite = new Database(dbPath, {fileMustExist:true})
  try {
    sqlite.pragma('foreign_keys = ON')
    const link = sqlite.prepare("SELECT id, subject FROM external_identity_links WHERE id='accept_h4b_link_coach'").get() as {id:string;subject:string}|undefined
    assert.ok(link, 'Expected canonical seeded coach link')
    assert.equal(link.subject, '65375bd2-4a7a-4a00-bf41-d289ec1d54f5', 'Refuse fixture drift')
    const changed = sqlite.transaction(() => {
      const update = sqlite.prepare("UPDATE external_identity_links SET subject=?, updated_at=? WHERE id='accept_h4b_link_coach' AND subject=?").run(data.user!.id,new Date().toISOString(),link.subject)
      assert.equal(update.changes,1)
      assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
    })
    changed.immediate()
  } finally { sqlite.close() }
  const out = resolve('.tmp/kan-849-local-auth.env')
  mkdirSync(dirname(out),{recursive:true})
  // Private local fixture only; never write keys or credentials to tracked files.
  writeFileSync(out, [
    'NEXT_PUBLIC_SUPABASE_URL='+api,
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='+key,
    'SUPABASE_AUTH_TEST_EMAIL='+email,
    'SUPABASE_AUTH_TEST_PASSWORD='+password,
    'SQLITE_SCENARIO_MODE=1',
    'EPT_IDENTITY_BACKEND=sqlite',
    'SQLITE_DATABASE_PATH='+dbPath.replaceAll('\\','/'),
  ].join('\n')+'\n',{flag:'wx',mode:0o600})
  process.stdout.write('KAN-849 LOCAL_AUTH_H2_READY '+JSON.stringify({ status:'PASS',sqlite:'disposable',auth:'local',linkedActor:'accept_h4b_coach',envFile:out })+'\n')
}
void main().catch(error=>{process.stderr.write('KAN-849 LOCAL_AUTH_H2_FAILED '+(error instanceof Error?error.message:String(error))+'\n');process.exitCode=1})
