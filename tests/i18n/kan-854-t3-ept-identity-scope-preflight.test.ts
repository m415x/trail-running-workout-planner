import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, resolve, sep } from 'node:path'
import Database from 'better-sqlite3'
import test from 'node:test'
import { resolveKan791AcceptanceIdentity } from '../../lib/auth/kan-791-acceptance-identity'

test('KAN-854/T3 inspects dedicated coach subject and active EPT scope only in disposable SQLite', () => {
  const require = createRequire(import.meta.url)
  const { loadEnvConfig } = require('@next/env') as {loadEnvConfig:(dir:string,dev?:boolean)=>unknown}
  loadEnvConfig(process.cwd(), true)
  const required=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','KAN791_ACCEPTANCE_EMAIL','KAN791_ACCEPTANCE_SUBJECT','KAN791_AUTH_TEST_PASSWORD','SQLITE_DATABASE_PATH'] as const
  const missing=required.filter(key=>!process.env[key]?.trim())
  if(missing.length) {
    process.stdout.write('KAN-854 T3_EPT_IDENTITY_PREFLIGHT '+JSON.stringify({outcome:'BLOCKED',reason:'missing-prerequisites',missingVariableNames:missing})+'\n')
    return
  }
  assert.notEqual(process.env.NODE_ENV,'production','EXPERIMENT_SETUP_ERROR: production forbidden')
  assert.notEqual(process.env.CI,'true','EXPERIMENT_SETUP_ERROR: CI forbidden')
  const identity=resolveKan791AcceptanceIdentity({email:process.env.KAN791_ACCEPTANCE_EMAIL!,subject:process.env.KAN791_ACCEPTANCE_SUBJECT!})
  const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!)
  assert.equal(url.protocol,'https:','EXPERIMENT_SETUP_ERROR: Supabase project URL must be HTTPS')
  assert.ok(url.hostname.endsWith('.supabase.co'),'EXPERIMENT_SETUP_ERROR: confirm target project manually; non-Supabase host')
  const dbPath=resolve(process.env.SQLITE_DATABASE_PATH!)
  assert.ok(existsSync(dbPath),'EXPERIMENT_SETUP_ERROR: disposable SQLite not prepared')
  const actual=realpathSync(dbPath)
  const temp=realpathSync(tmpdir())
  const norm=(v:string)=>process.platform==='win32'?v.toLowerCase():v
  assert.ok(norm(actual).startsWith(norm(temp)+sep),'EXPERIMENT_SETUP_ERROR: only OS temp fixtures may be read')
  assert.ok(basename(dirname(actual)).startsWith('kan-854-'),'EXPERIMENT_SETUP_ERROR: only KAN-854 disposable fixtures may be read')
  assert.notEqual(norm(actual),norm(resolve('sqlite.db')),'EXPERIMENT_SETUP_ERROR: development DB forbidden')
  const db=new Database(actual,{readonly:true,fileMustExist:true})
  try {
    const rows=db.prepare(`SELECT l.user_id AS userId, u.email AS email, u.is_deleted AS userDeleted,
      l.is_deleted AS linkDeleted, m.team_id AS teamId, m.preset AS preset,
      m.is_active AS membershipActive, m.is_deleted AS membershipDeleted,
      m.effective_from AS effectiveFrom, m.effective_until AS effectiveUntil,
      t.is_deleted AS teamDeleted
      FROM external_identity_links l
      JOIN users u ON u.id=l.user_id
      JOIN team_memberships m ON m.user_id=u.id
      JOIN teams t ON t.id=m.team_id
      WHERE l.provider='supabase' AND l.subject=?`).all(identity.subject) as Array<{
        userId:string;email:string;userDeleted:number;linkDeleted:number;teamId:string;preset:string;
        membershipActive:number;membershipDeleted:number;effectiveFrom:string;effectiveUntil:string|null;teamDeleted:number
      }>
    const valid=rows.filter(r=>r.email.toLowerCase()===identity.email && r.userDeleted===0 &&
      r.linkDeleted===0 && r.membershipActive===1 && r.membershipDeleted===0 && r.teamDeleted===0 &&
      r.effectiveFrom <= new Date().toISOString() && (!r.effectiveUntil || r.effectiveUntil > new Date().toISOString()))
    const coach=valid.filter(r=>r.preset==='coach')
    const outcome=coach.length===1 && valid.length===1?'READY':'BLOCKED'
    process.stdout.write('KAN-854 T3_EPT_IDENTITY_PREFLIGHT '+JSON.stringify({
      outcome, subjectMatchedRows:rows.length, activeScopeRows:valid.length,
      coachScopeRows:coach.length, roleByMembershipOnly:true,
      supabaseProjectVerifiedByAuth:false, httpAuthValidated:false, teamId:outcome==='READY'?coach[0].teamId:undefined,
    })+'\n')
    assert.equal(outcome,'READY','EXPERIMENT_INCONCLUSIVE: dedicated subject not linked to exactly one active coach membership in disposable EPT')
  } finally { db.close() }
})
