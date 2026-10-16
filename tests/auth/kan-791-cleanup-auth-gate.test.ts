import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

test('KAN-791 cleanup requires real Supabase identity proof before opening PostgreSQL',()=>{
 const cli=readFileSync('scripts/kan-791-pg-coach-identity.ts','utf8')
 assert.match(cli,/mode==='apply'\s*\|\|\s*mode==='cleanup'/)
 assert.match(cli,/authorizeKan791ApplyBeforeDatabase\(\{email,subject\}/)
 const auth=cli.indexOf('authorizeKan791ApplyBeforeDatabase({email,subject}')
 const db=cli.indexOf('openDatabase:()=>postgres(url,')
 const cleanup=cli.indexOf('cleanupKan791CoachIdentity(tx,input)')
 assert.ok(auth>=0 && db>auth && cleanup>db,'Both mutations must require proof before DB')
 assert.match(cli,/if\(mode==='verify'\) await tx`SET TRANSACTION READ ONLY`/)
})
