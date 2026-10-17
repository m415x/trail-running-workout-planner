'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import postgres from 'postgres'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'
import { ACTIVE_TEAM_COOKIE_NAME } from '@/lib/authorization/active-team-selection'
import { createAuthorizedReviewSnapshotPostgresSessionOperations } from '@/lib/session-generation/authorized-review-snapshot-postgres-session'

let pgClient: ReturnType<typeof postgres> | null = null

function currentPostgresClient() {
  if (pgClient) return pgClient
  const url = process.env.SUPABASE_DATABASE_URL
  if (!url) throw new Error('SUPABASE_DATABASE_URL no está configurada')
  pgClient = postgres(url, { prepare: false, max: 1 })
  return pgClient
}

function operations(auth: Awaited<ReturnType<typeof createSupabaseServerClient>>['auth']) {
  return createAuthorizedReviewSnapshotPostgresSessionOperations({
    client: currentPostgresClient(),
    auth,
    readPersistedTeamId: async () => {
      const store = await cookies()
      return store.get(ACTIVE_TEAM_COOKIE_NAME)?.value?.trim() || null
    },
    now: () => new Date().toISOString(),
  })
}

/** Authorized read-only PostgreSQL identity for the dedicated Coach review route. */
export async function getCoachPostgresReviewPlanContext(planId: string) {
  if (!planId?.trim()) return {kind:'denied' as const}
  const supabase=await createSupabaseServerClient()
  return operations(supabase.auth).getPlanContext({groupTrainingPlanId:planId})
}

export async function getCoachPostgresReviewMicrocycles(planId:string) {
  if(!planId?.trim()) return {kind:'denied' as const}
  const supabase=await createSupabaseServerClient()
  return operations(supabase.auth).getReviewMicrocycles({groupTrainingPlanId:planId})
}

/** Explicit Coach CREATE. The client may name only the Plan, never actors or payload. */
export async function createCoachSessionReviewSnapshot(formData: FormData) {
  const planId = formData.get('planId')
  if (typeof planId !== 'string' || !planId.trim()) {
    return {kind: 'denied' as const}
  }
  const supabase = await createSupabaseServerClient()
  const created=await operations(supabase.auth).create({groupTrainingPlanId:planId})
  if(created.kind!=='created') return created
  const locale=formData.get('locale')==='en'?'en':'es'
  const base=locale==='en'?'/en/dashboard':'/dashboard'
  redirect(`${base}/planning/${encodeURIComponent(planId)}/review?snapshotId=${encodeURIComponent(created.snapshotId)}`)
}

/** Read-only review; GET never generates, consumes, or refreshes a review. */
export async function readCoachSessionReviewSnapshot(input: {
  readonly planId: string
  readonly snapshotId: string
}) {
  const supabase = await createSupabaseServerClient()
  return operations(supabase.auth).get({
    groupTrainingPlanId:input.planId,
    snapshotId:input.snapshotId,
  })
}

/** Confirm by opaque server-issued ID, never accepting a proposal or explanations. */
export async function confirmCoachSessionReviewSnapshot(formData: FormData) {
  const planId=formData.get('planId')
  const snapshotId=formData.get('snapshotId')
  if(typeof planId!=='string'||!planId.trim() ||
    typeof snapshotId!=='string'||!snapshotId.trim()) {
    return {kind:'denied' as const}
  }
  const supabase=await createSupabaseServerClient()
  const result=await operations(supabase.auth).confirm({
    groupTrainingPlanId:planId,snapshotId,
  })
  if(result.kind==='consumed'||result.kind==='already_consumed'){
    revalidatePath('/dashboard/planning/'+planId+'/review')
    revalidatePath('/dashboard/sessions')
    revalidatePath('/plan')
  }
  if(result.kind==='consumed'||result.kind==='already_consumed') {
    const locale=formData.get('locale')==='en'?'en':'es'
    const base=locale==='en'?'/en/dashboard':'/dashboard'
    redirect(`${base}/planning/${encodeURIComponent(planId)}/review`)
  }
  return result
}
