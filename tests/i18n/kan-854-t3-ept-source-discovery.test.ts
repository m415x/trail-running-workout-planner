import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync, realpathSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import Database from 'better-sqlite3'
import test from 'node:test'

test('KAN-854/T3 discovers existing EPT subject scope from read-only acceptance source', () => {
  const require = createRequire(import.meta.url)
  const {loadEnvConfig} = require('@next/env') as {loadEnvConfig:(dir:string,dev?:boolean)=>unknown}
  loadEnvConfig(process.cwd(),true)
  const subject=process.env.KAN791_ACCEPTANCE_SUBJECT?.trim()
  if(!subject) {
    process.stdout.write('KAN-854 T3_SOURCE_DISCOVERY '+JSON.stringify({outcome:'BLOCKED',reason:'authenticated-subject-not-configured'})+'\n')
    return
  }
  assert.match(subject,/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i)
  const path=resolve(process.env.KAN854_EPT_SOURCE_DB?.trim() || 'sqlite.db')
  if(!existsSync(path)) {
    process.stdout.write('KAN-854 T3_SOURCE_DISCOVERY '+JSON.stringify({outcome:'BLOCKED',reason:'acceptance-source-not-found',source:basename(path)})+'\n')
    return
  }
  const dbPath=realpathSync(path)
  const before=createHash('sha256').update(require('node:fs').readFileSync(dbPath) as Buffer).digest('hex')
  const db=new Database(dbPath,{readonly:true,fileMustExist:true})
  try {
    db.pragma('query_only = ON')
    const required=['users','external_identity_links','team_memberships','teams']
    const available=new Set((db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name:string}[]).map(r=>r.name))
    if(required.some(name=>!available.has(name))) {
      process.stdout.write('KAN-854 T3_SOURCE_DISCOVERY '+JSON.stringify({outcome:'BLOCKED',reason:'source-schema-incompatible',source:basename(dbPath)})+'\n')
      return
    }
    const links=db.prepare("SELECT l.user_id AS userId,l.is_deleted AS linkDeleted,u.is_deleted AS userDeleted FROM external_identity_links l JOIN users u ON u.id=l.user_id WHERE l.provider='supabase' AND l.subject=?").all(subject) as Array<{userId:string;linkDeleted:number;userDeleted:number}>
    const usable=links.filter(row=>row.linkDeleted===0&&row.userDeleted===0)
    let memberships: Array<{preset:string;active:number;deleted:number;teamDeleted:number;from:string;until:string|null}>=[]
    if(usable.length===1) {
      memberships=db.prepare("SELECT m.preset AS preset,m.is_active AS active,m.is_deleted AS deleted,t.is_deleted AS teamDeleted,m.effective_from AS 'from',m.effective_until AS 'until' FROM team_memberships m JOIN teams t ON t.id=m.team_id WHERE m.user_id=?").all(usable[0].userId) as typeof memberships
    }
    const now=new Date().toISOString()
    const active=memberships.filter(r=>r.active===1&&r.deleted===0&&r.teamDeleted===0&&r.from<=now&&(!r.until||r.until>now))
    const coach=active.filter(r=>r.preset==='coach')
    const outcome=usable.length===1&&active.length===1&&coach.length===1?'SOURCE_ELIGIBLE':'BLOCKED'
    const result={outcome,reason:outcome==='BLOCKED'?'no-single-active-coach-scope':undefined,
      source:basename(dbPath),sha256:before,subjectLinkCount:links.length,
      activeSubjectLinks:usable.length,activeTeamMemberships:active.length,activeCoachMemberships:coach.length,
      capabilities:'not-asserted',snapshotCreated:false,readonly:true}
    process.stdout.write('KAN-854 T3_SOURCE_DISCOVERY '+JSON.stringify(result)+'\n')
  } finally {
    db.close()
    const after=createHash('sha256').update(require('node:fs').readFileSync(dbPath) as Buffer).digest('hex')
    assert.equal(after,before,'EXPERIMENT_SETUP_ERROR: read-only discovery source bytes changed')
  }
})
