import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {assertKan791LocalDatabaseTargets} from '@/lib/auth/kan-791-provisioner-targets'

const local='postgresql://postgres:LOCAL_PLACEHOLDER@127.0.0.1:55439/kan789_acceptance'
test('KAN-791 accepts only both configured acceptance database destinations',()=>{
 assert.doesNotThrow(()=>assertKan791LocalDatabaseTargets(local,local))
})
test('KAN-791 refuses absent or remote runtime target before database creation',()=>{
 for(const other of [undefined,'','postgresql://postgres:x@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
  'postgresql://postgres:x@127.0.0.1:55439/other_db',
  'postgresql://postgres:x@127.0.0.1:55440/kan789_acceptance']) {
  assert.throws(()=>assertKan791LocalDatabaseTargets(local,other),/database|target|acceptance/i)
 }
})
test('KAN-791 refuses wrong acceptance target even when both settings agree',()=>{
 for(const bad of ['postgresql://postgres:x@localhost:55439/kan789_acceptance',
  'postgresql://postgres:x@127.0.0.1:55439/postgres',
  'postgresql://postgres:x@127.0.0.1:6543/kan789_acceptance']) {
  assert.throws(()=>assertKan791LocalDatabaseTargets(bad,bad),/database|target|acceptance/i)
 }
})
test('KAN-791 CLI delegates database guard before opening SQL client',()=>{
 const source=readFileSync('scripts/kan-791-pg-coach-identity.ts','utf8')
 const check=source.indexOf('assertKan791LocalDatabaseTargets(')
 const open=source.indexOf('postgres(url,')
 assert.ok(check>=0 && open>check)
})
