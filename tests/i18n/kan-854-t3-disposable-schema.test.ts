import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import test from 'node:test'

test('KAN-854/T3 prepares isolated canonical SQLite schema without identities', {timeout:180_000},()=>{
  assert.notEqual(process.env.NODE_ENV,'production')
  assert.notEqual(process.env.CI,'true')
  const root=resolve('.')
  const dir=mkdtempSync(join(tmpdir(),'kan-854-schema-'))
  const dbPath=join(dir,'acceptance.sqlite')
  const req=createRequire(import.meta.url)
  const tsx=req.resolve('tsx/cli')
  let successful=false
  try{
    assert.equal(existsSync(dbPath),false)
    const cmd=spawnSync(process.execPath,[tsx,resolve(root,'scripts/upgrade-sqlite.ts')],{
      cwd:root,encoding:'utf8',timeout:120_000,maxBuffer:6*1024*1024,
      env:{...process.env,SQLITE_SCENARIO_MODE:'1',SQLITE_DATABASE_PATH:dbPath,TSX_TSCONFIG_PATH:join(root,'tsconfig.json')},
    })
    assert.equal(cmd.error,undefined,'EXPERIMENT_SETUP_ERROR: canonical upgrade failed to launch')
    assert.equal(cmd.status,0,'EXPERIMENT_SETUP_ERROR: canonical upgrade failed: '+cmd.stdout+cmd.stderr)
    assert.ok(existsSync(dbPath),'EXPERIMENT_SETUP_ERROR: canonical DB not created')
    const db=new Database(dbPath,{readonly:true,fileMustExist:true})
    try{
      db.pragma('query_only = ON')
      assert.equal(db.pragma('integrity_check',{simple:true}),'ok')
      assert.deepEqual(db.pragma('foreign_key_check'),[])
      const required=['users','external_identity_links','team_memberships','teams','athlete_groups','athlete_profiles']
      const schema=db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type,name").all() as Array<{type:string;name:string;tbl_name:string;sql:string|null}>
      for(const name of required) assert.ok(schema.some(row=>row.type==='table'&&row.name===name),'EXPERIMENT_SETUP_ERROR: missing '+name)
      const unique=db.pragma('index_list(external_identity_links)') as Array<{name:string;unique:number}>
      assert.ok(unique.some(index=>index.unique===1),'EXPERIMENT_SETUP_ERROR: unique identity index absent')
      const membershipIndexes=db.pragma('index_list(team_memberships)') as Array<{name:string;unique:number}>
      assert.ok(membershipIndexes.length>0,'EXPERIMENT_SETUP_ERROR: membership indexes absent')
      const linkForeignKeys=db.pragma('foreign_key_list(external_identity_links)') as Array<{table:string;from:string;to:string}>
      const membershipForeignKeys=db.pragma('foreign_key_list(team_memberships)') as Array<{table:string;from:string;to:string}>
      assert.ok(linkForeignKeys.some(fk=>fk.table==='users'&&fk.from==='user_id'),'EXPERIMENT_SETUP_ERROR: missing identity link user FK')
      assert.ok(membershipForeignKeys.some(fk=>fk.table==='users'&&fk.from==='user_id'),'EXPERIMENT_SETUP_ERROR: missing membership user FK')
      assert.ok(membershipForeignKeys.some(fk=>fk.table==='teams'&&fk.from==='team_id'),'EXPERIMENT_SETUP_ERROR: missing membership team FK')
      for(const table of ['users','external_identity_links','team_memberships','teams']){
        const count=(db.prepare('SELECT COUNT(*) AS total FROM "'+table+'"').get() as {total:number}).total
        assert.equal(count,0,'EXPERIMENT_SETUP_ERROR: schema fixture unexpectedly contains records in '+table)
      }
      const schemaSha256=createHash('sha256').update(JSON.stringify(schema)).digest('hex')
      const migrationFiles=spawnSync('git',['ls-files','drizzle/sqlite','db/migrations'],{cwd:root,encoding:'utf8'})
      assert.equal(migrationFiles.status,0)
      const paths=migrationFiles.stdout.trim().split(/\r?\n/).filter(Boolean)
      const h=createHash('sha256')
      for(const path of paths){h.update(path+'\\0');h.update(readFileSync(resolve(root,path)))}
      const migrationSourcesSha256=h.digest('hex')
      const dbSha256=createHash('sha256').update(readFileSync(dbPath)).digest('hex')
      process.stdout.write('KAN-854 T3_DISPOSABLE_SCHEMA '+JSON.stringify({
        outcome:'SCHEMA_READY',directory:dir,database:dbPath,schemaSha256,migrationSourcesSha256,dbSha256,
        objects:schema.length,identityIndexCount:unique.length,membershipIndexCount:membershipIndexes.length,integrity:'ok',foreignKeys:'ok',identityRows:0,
        migrationsCommand:'SQLITE_SCENARIO_MODE=1 SQLITE_DATABASE_PATH=<temp> tsx scripts/upgrade-sqlite.ts',
        authorization:'BLOCKED-unprovisioned',sourceMemberships:'not-copied'
      })+'\n')
      successful=true
    }finally{db.close()}
  }finally{if(!successful)rmSync(dir,{recursive:true,force:true})}
})
