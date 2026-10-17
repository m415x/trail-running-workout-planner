import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'
import {config} from 'dotenv'
import {createClient} from '@supabase/supabase-js'
import {createPostgresIdentityEvidence} from '@/lib/auth/postgres-identity-evidence'
import {readSupabaseServerSessionState} from '@/lib/auth/supabase-server-session-state'
import {resolveAuthenticatedEptIdentity} from '@/lib/auth/server-session-identity'
import {resolveKan791AcceptanceIdentity} from '@/lib/auth/kan-791-acceptance-identity'

config({path:'.env.local'})

test('KAN-791 T6-D dedicated real Supabase Coach resolves PG EPT identity without SQLite',async()=>{
  const required=(name:string)=>{
    const value=process.env[name]?.trim()
    assert.ok(value,name+' required: no SKIP')
    return value
  }
  const url=required('KAN789_PG_URL')
  const db=new URL(url)
  assert.equal(db.hostname,'127.0.0.1')
  assert.equal(db.port,'55439')
  assert.equal(db.pathname,'/kan789_acceptance')
  const email=required('KAN791_AUTH_TEST_EMAIL')
  resolveKan791AcceptanceIdentity({email,subject:required('KAN791_AUTH_SUBJECT')})
  const password=required('KAN791_AUTH_TEST_PASSWORD')
  const authUrl=required('NEXT_PUBLIC_SUPABASE_URL')
  const publishable=required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  const sql=postgres(url,{max:1,prepare:false})
  const supabase=createClient(authUrl,publishable,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  })
  try {
    const login=await supabase.auth.signInWithPassword({email,password})
    assert.ifError(login.error)
    assert.ok(login.data.session,'Real Supabase Auth session required')
    const verified=await readSupabaseServerSessionState(supabase.auth)
    assert.equal(verified.status,'verified','Supabase claims/getUser must agree')
    if(verified.status!=='verified') throw new Error('Unverified Supabase Auth')
    const lookup=createPostgresIdentityEvidence(sql)
    const identity=await resolveAuthenticatedEptIdentity(verified.externalSubject,lookup)
    assert.equal(identity.status,'authenticated','Dedicated Supabase user must be linked in PostgreSQL')
    if(identity.status!=='authenticated') throw new Error('Dedicated PostgreSQL EPT User not linked')
    const memberships=await lookup.loadMemberships(identity.userId)
    const team='kan791-annual-pg-239-team'
    const valid=memberships.filter(m=>
      m.teamId===team && m.preset==='coach' && m.isActive && !m.isDeleted &&
      m.effectiveFrom<=new Date().toISOString() &&
      (m.effectiveUntil===null || m.effectiveUntil>new Date().toISOString()))
    assert.equal(valid.length,1,'One effective PG Coach membership required')
    process.stdout.write('KAN-791 dedicated real Supabase H2 and PostgreSQL EPT/Coach H3: PASS\\n')
  } finally {
    await supabase.auth.signOut()
    await sql.end()
  }
})
