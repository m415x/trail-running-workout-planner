import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import type {Kan791AcceptanceIdentity} from './kan-791-acceptance-identity'

/**
 * Proves operator-supplied EPT identity attributes via a real Supabase login and
 * authenticated getUser lookup. This does not authorize EPT Team membership.
 * Never log credentials, tokens or identity data on failure.
 */
export async function verifyKan791SupabaseIdentity(expected:Kan791AcceptanceIdentity):Promise<void> {
 const required=(key:string)=>{
  const value=process.env[key]?.trim()
  assert.ok(value, 'Dedicated Supabase authentication configuration missing')
  return value
 }
 const url=required('NEXT_PUBLIC_SUPABASE_URL')
 const key=required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
 const password=required('KAN791_AUTH_TEST_PASSWORD')
 const client=createClient(url,key,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
 })
 try {
  const result=await client.auth.signInWithPassword({email:expected.email,password})
  if(result.error || !result.data.session) throw new Error('Dedicated Supabase authentication failed')
  const verified=await client.auth.getUser(result.data.session.access_token)
  const user=verified.data.user
  if(verified.error || !user) throw new Error('Dedicated Supabase identity not verified')
  if(user.id.toLowerCase()!==expected.subject.toLowerCase() ||
     user.email?.trim().toLowerCase()!==expected.email.trim().toLowerCase() ||
     result.data.user?.id!==user.id) {
    throw new Error('Dedicated Supabase identity mismatch')
  }
 } finally {
  // Supabase credentials are used only in this process; never persisted or printed.
  await client.auth.signOut().catch(()=>undefined)
 }
}
