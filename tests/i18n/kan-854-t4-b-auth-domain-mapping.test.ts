import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {existsSync,readFileSync} from 'node:fs'
import {basename,dirname,resolve} from 'node:path'
import Database from 'better-sqlite3'
import test from 'node:test'
import {resolveActiveTeamContext} from '../../lib/authorization/active-team-context'
import {authorizeEffectiveCapability} from '../../lib/authorization/effective-authorization'
const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex')
test('KAN-854/T4 validates dedicated Supabase subject link to fixture coach',()=>{
 const require=createRequire(import.meta.url)
 const {loadEnvConfig}=require('@next/env') as {loadEnvConfig:(p:string,d:boolean)=>unknown}
 loadEnvConfig(resolve('.'),true)
 const path=process.env.KAN854_T4_DOMAIN_DB
 if(!path){process.stdout.write('KAN-854 T4_OPTIONS_CAUSAL '+JSON.stringify({outcome:'BLOCKED',reason:'domain-db-not-configured'})+'\n');return}
 const source=resolve(path)
 assert.equal(basename(source),'acceptance-domain.sqlite')
 assert.match(basename(dirname(source)),/^kan-854-t4-domain-/)
 assert.ok(existsSync(source))
 const before=sha(source)
 const db=new Database(source,{readonly:true,fileMustExist:true})
 try{
  db.pragma('query_only=ON')
  const subject=process.env.KAN791_ACCEPTANCE_SUBJECT?.trim().toLowerCase()
  assert.ok(subject,'EXPERIMENT_SETUP_ERROR: dedicated subject is not configured')
  const links=db.prepare("SELECT user_id userId,provider,subject FROM external_identity_links WHERE lower(subject)=? AND is_deleted=0").all(subject) as Array<{userId:string;provider:string;subject:string}>
  const user=db.prepare('SELECT id FROM users').get() as {id:string}
  const mapping={linkCount:links.length,linkedToFixtureUser:links.some(link=>link.userId===user.id),providerKinds:[...new Set(links.map(link=>link.provider))],userExists:!!db.prepare('SELECT id FROM users WHERE id=? AND is_deleted=0').get(user.id)}
  process.stdout.write('KAN-854 T4_B_IDENTITY_MAPPING '+JSON.stringify({mapping,subjectValueLogged:false,userIdLogged:false,readOnly:true})+'\n')
  assert.ok(mapping.linkedToFixtureUser,'EXPERIMENT_INCONCLUSIVE: Supabase subject not linked to fixture coach in SQLite')

  const member=db.prepare('SELECT user_id userId,team_id teamId,preset,effective_from effectiveFrom,effective_until effectiveUntil,is_active isActive,is_deleted isDeleted FROM team_memberships WHERE user_id=?').all(user.id) as Array<{userId:string;teamId:string;preset:string;effectiveFrom:string;effectiveUntil:string|null;isActive:number;isDeleted:number}>
  const group=db.prepare('SELECT id,team_id teamId,is_active isActive,is_deleted isDeleted,category_code categoryCode,level_code levelCode FROM athlete_groups').all() as Array<{id:string;teamId:string;isActive:number;isDeleted:number;categoryCode:string;levelCode:string}>
  const plans=db.prepare('SELECT g.id groupId,p.id planId,a.id macroId,e.id mesoId,m.id microId,m.start_date startDate,m.end_date endDate FROM athlete_groups g JOIN group_training_plans p ON p.group_id=g.id JOIN macrocycles a ON a.group_training_plan_id=p.id JOIN mesocycles e ON e.macrocycle_id=a.id JOIN microcycles m ON m.mesocycle_id=e.id').all() as Array<{groupId:string;planId:string;macroId:string;mesoId:string;microId:string;startDate:string;endDate:string}>
  const at=new Date().toISOString()
  const active=resolveActiveTeamContext({persistedTeamId:null,memberships:member.map(m=>({teamId:m.teamId,isActive:!!m.isActive,isDeleted:!!m.isDeleted,effectiveFrom:m.effectiveFrom,effectiveUntil:m.effectiveUntil})),onDate:at})
  const decisions=group.map(g=>({groupId:g.id,belongsToTeam:active.status==='resolved'&&g.teamId===active.teamId,active:!!g.isActive&&!g.isDeleted,planningAllowed:active.status==='resolved'?authorizeEffectiveCapability({authenticatedUserId:user.id,teamId:active.teamId,capability:'planning.manage',resource:{teamId:g.teamId,sportingGroupId:g.id},at,memberships:member.map(m=>({userId:m.userId,teamId:m.teamId,preset:m.preset as 'coach',effectiveFrom:m.effectiveFrom,effectiveUntil:m.effectiveUntil,isActive:!!m.isActive})),athleteProfiles:[],grants:[]}).allowed:false}))
  const found=decisions.some(d=>d.belongsToTeam&&d.active&&d.planningAllowed&&plans.some(p=>p.groupId===d.groupId))
  const result={outcome:found?'SOURCE_DOMAIN_AUTH_READY':'SOURCE_DOMAIN_AUTH_DENY',membershipCount:member.length,groupCount:group.length,chainCount:plans.length,h3:active.status,decisions,sourceUnchanged:sha(source)===before,scope:'readonly-source-fixture-not-next-runtime'}
  process.stdout.write('KAN-854 T4_OPTIONS_CAUSAL '+JSON.stringify(result)+'\n')
  assert.ok(found,'EXPERIMENT_INCONCLUSIVE: source fixture fails H3/H4A domain visibility')
  assert.equal(sha(source),before)
 }finally{db.close()}
})
