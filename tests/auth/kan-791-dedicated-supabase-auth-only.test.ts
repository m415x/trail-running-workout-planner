import assert from 'node:assert/strict'
import {config} from 'dotenv'
import test from 'node:test'
import {resolveKan791AcceptanceIdentity} from '@/lib/auth/kan-791-acceptance-identity'
import {verifyKan791SupabaseIdentity} from '@/lib/auth/kan-791-supabase-identity-verification'

config({path:'.env.local'})

test('KAN-791 dedicated Supabase real login and getUser match EPT subject/email without PG mutation',async()=>{
 const expected=resolveKan791AcceptanceIdentity({
  email:process.env.KAN791_AUTH_TEST_EMAIL ?? '',
  subject:process.env.KAN791_AUTH_SUBJECT ?? '',
 })
 assert.ok(process.env.KAN791_AUTH_TEST_PASSWORD,'KAN791_AUTH_TEST_PASSWORD required; no SKIP')
 assert.ok(process.env.NEXT_PUBLIC_SUPABASE_URL,'NEXT_PUBLIC_SUPABASE_URL required; no SKIP')
 assert.ok(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY required; no SKIP')
 await verifyKan791SupabaseIdentity(expected)
 process.stdout.write('KAN-791 dedicated Supabase Auth identity: PASS (no PostgreSQL writes)\n')
})
