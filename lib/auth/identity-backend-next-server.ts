import postgres from 'postgres'
import { configuredIdentityBackend } from './identity-backend-selection'
import { createExternalIdentityLookup } from './external-identity-lookup'
import { createPostgresIdentityEvidence } from './postgres-identity-evidence'

let client:ReturnType<typeof postgres>|null=null
export function postgresIdentityClient(){
  if(client) return client
  const url=process.env.SUPABASE_DATABASE_URL?.trim()
  if(!url) throw new Error('PostgreSQL identity backend requires SUPABASE_DATABASE_URL')
  client=postgres(url,{max:1,prepare:false})
  return client
}

/** Backend decision is deployment-owned, never request-derived. */
export function createNextServerIdentityEvidence(){
  if(configuredIdentityBackend()==='sqlite'){
    return {backend:'sqlite' as const,lookup:createExternalIdentityLookup(),memberships:null}
  }
  const evidence=createPostgresIdentityEvidence(postgresIdentityClient())
  return {backend:'postgres' as const,lookup:evidence,memberships:evidence}
}
