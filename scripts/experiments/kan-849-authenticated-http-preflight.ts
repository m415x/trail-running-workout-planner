import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import Database from 'better-sqlite3'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local', quiet: true })
const required = (key: string) => {
  const value = process.env[key]?.trim()
  if (!value) throw new Error('KAN-849 PRECHECK missing ' + key)
  return value
}
const mask = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 12)
async function main(): Promise<void> {
try {
const root = process.cwd()
assert.ok(root.toLowerCase().endsWith('trail-running-workout-planner-kan-849-exp'), 'Disposable experimental worktree required')
const dbPath = realpathSync(resolve(required('SQLITE_DATABASE_PATH')))
assert.ok(existsSync(dbPath), 'Disposable database does not exist')
assert.notEqual(dbPath.toLowerCase(), resolve('sqlite.db').toLowerCase(), 'Development DB forbidden')
const email = required('SUPABASE_AUTH_TEST_EMAIL')
const password = required('SUPABASE_AUTH_TEST_PASSWORD')
const client = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})


  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session) throw error ?? new Error('No acceptance session')
  const claims = await client.auth.getClaims()
  const user = await client.auth.getUser()
  const subject = claims.data?.claims?.sub?.trim()
  assert.ok(!claims.error && subject, 'Claims verification failed')
  assert.ok(!user.error && user.data.user?.id === subject, 'User/claims mismatch')
  const sqlite = new Database(dbPath, { readonly: true, fileMustExist: true })
  try {
    const rows = sqlite.prepare(`SELECT l.user_id AS userId, l.is_deleted AS linkDeleted,
      u.is_deleted AS userDeleted FROM external_identity_links l
      JOIN users u ON u.id = l.user_id WHERE l.provider = ? AND l.subject = ?`).all('supabase', subject) as Array<{userId:string;linkDeleted:number;userDeleted:number}>
    assert.equal(rows.length, 1, 'H2 must resolve to exactly one EPT identity in disposable SQLite')
    assert.equal(rows[0]!.linkDeleted, 0)
    assert.equal(rows[0]!.userDeleted, 0)
    const memberships = sqlite.prepare(`SELECT team_id AS teamId, preset, is_active AS active,
      is_deleted AS deleted, effective_from AS effectiveFrom, effective_until AS effectiveUntil
      FROM team_memberships WHERE user_id = ? ORDER BY team_id`).all(rows[0]!.userId) as Array<{teamId:string;preset:string;active:number;deleted:number;effectiveFrom:string;effectiveUntil:string|null}>
    const now = new Date().toISOString()
    const valid = memberships.filter(m=>m.active===1 && m.deleted===0 && m.effectiveFrom<=now && (m.effectiveUntil===null || m.effectiveUntil>now))
    assert.ok(valid.length >= 1, 'No applicable TeamMembership for verified H2 identity')
    process.stdout.write('KAN-849 AUTHENTICATED_HTTP_PREFLIGHT ' + JSON.stringify({
      status: 'PASS', session: 'verified', linkedEptUserHash: mask(rows[0]!.userId),
      subjectHash: mask(subject), applicableTeamCount: valid.length,
      teams: valid.map(m=>({teamHash:mask(m.teamId), preset:m.preset})),
      sqlite: 'disposable-readonly',
    }) + '\n')
  } finally { sqlite.close() }
} catch (error) {
  process.stderr.write('KAN-849 AUTHENTICATED_HTTP_PREFLIGHT FAILED: ' + (error instanceof Error ? error.message : String(error)) + '\n')
  process.exitCode = 1
}
}

void main().catch(error => {
  process.stderr.write('KAN-849 AUTHENTICATED_HTTP_PREFLIGHT UNHANDLED: ' + (error instanceof Error ? error.message : String(error)) + '\n')
  process.exitCode = 1
})
