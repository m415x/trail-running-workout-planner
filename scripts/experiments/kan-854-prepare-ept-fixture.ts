import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { createClient } from '@supabase/supabase-js'
import { resolveKan791AcceptanceIdentity } from '../../lib/auth/kan-791-acceptance-identity'

const require=createRequire(import.meta.url)
const {loadEnvConfig}=require('@next/env') as {loadEnvConfig:(dir:string,dev?:boolean)=>unknown}
loadEnvConfig(resolve('.'),true)

async function main(){
  assert.notEqual(process.env.NODE_ENV,'production','Production forbidden')
  assert.notEqual(process.env.CI,'true','CI forbidden')
  const required=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','KAN791_ACCEPTANCE_EMAIL','KAN791_ACCEPTANCE_SUBJECT','KAN791_AUTH_TEST_PASSWORD'] as const
  const missing=required.filter(name=>!process.env[name]?.trim())
  if(missing.length){ console.log('KAN-854 EPT_FIXTURE '+JSON.stringify({outcome:'BLOCKED',missingVariableNames:missing}));return }
  const identity=resolveKan791AcceptanceIdentity({email:process.env.KAN791_ACCEPTANCE_EMAIL!,subject:process.env.KAN791_ACCEPTANCE_SUBJECT!})
  const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  })
  try{
    const login=await client.auth.signInWithPassword({email:identity.email,password:process.env['KAN791_AUTH_TEST_PASSWORD']!})
    assert.ok(!login.error && login.data.session,'EXPERIMENT_SETUP_ERROR: authentic Supabase sign-in failed')
    const user=await client.auth.getUser(login.data.session.access_token)
    assert.ok(!user.error && user.data.user,'EXPERIMENT_SETUP_ERROR: authenticated getUser failed')
    assert.equal(user.data.user.id.toLowerCase(),identity.subject,'EXPERIMENT_INCONCLUSIVE: UUID differs')
    assert.equal(user.data.user.email?.toLowerCase(),identity.email,'EXPERIMENT_INCONCLUSIVE: email differs')
  }finally{await client.auth.signOut().catch(()=>undefined)}
  // Only after authentic Supabase proof: construct a new EPT-only fixture.
  const dir=mkdtempSync(join(tmpdir(),'kan-854-ept-'))
  const path=join(dir,'kan-854-acceptance.sqlite')
  writeFileSync(path,'')
  const cli=require.resolve('tsx/cli')
  const env={...process.env,SQLITE_SCENARIO_MODE:'1',SQLITE_DATABASE_PATH:path,TSX_TSCONFIG_PATH:resolve('tsconfig.json')}
  const upgrade=spawnSync(process.execPath,[cli,resolve('scripts/upgrade-sqlite.ts')],{
    cwd:resolve('.'),env,encoding:'utf8',timeout:120000,maxBuffer:3*1024*1024,
  })
  assert.equal(upgrade.status,0,'EXPERIMENT_SETUP_ERROR: canonical SQLite upgrade failed (fixture retained for diagnosis)')
  const db=new Database(path,{fileMustExist:true})
  try{
    db.pragma('foreign_keys=ON')
    db.transaction(()=>{
      const now=new Date().toISOString()
      db.prepare('INSERT INTO teams (id,name) VALUES (?,?)').run('kan_854_team','KAN-854 Acceptance')
      db.prepare('INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
        .run('kan_854_coach','kan854.coach',identity.email,'KAN854','Coach',now,now)
      db.prepare("INSERT INTO external_identity_links(id,user_id,provider,subject,created_at,updated_at) VALUES (?,?,'supabase',?,?,?)")
        .run('kan_854_link','kan_854_coach',identity.subject,now,now)
      db.prepare('INSERT INTO team_memberships(id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)')
        .run('kan_854_coach_membership','kan_854_coach','kan_854_team','coach',now,now,now)
      assert.deepEqual(db.pragma('foreign_key_check'),[])
    }).immediate()
  }finally{db.close()}
  process.stdout.write('KAN-854 EPT_FIXTURE '+JSON.stringify({outcome:'PREPARED',databasePath:path,scope:'disposable-only',identity:'real-supabase-login-verified',role:'coach',productionChanges:false})+'\n')
}
main().catch(error=>{process.stderr.write('KAN-854 EPT_FIXTURE_ERROR '+(error instanceof Error?error.message:String(error))+'\\n');process.exitCode=1})
