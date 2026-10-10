'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import { eq } from 'drizzle-orm'
import { teams } from '@/db/schema'
import { createActiveTeamNextServerContext } from '@/lib/authorization/active-team-next-server'
import { createH4aNextServerEvidenceSource } from '@/lib/authorization/h4a-next-server-authorization'
import { createH6EconomicAuthorizationBoundary } from '@/lib/authorization/h6-economic-authorization'
import { createH6PolicyAction } from '@/lib/memberships/h6-policy-action'
import { createMembershipServerActionRuntime } from '@/lib/memberships/billing-server-action-runtime'
import { createExternalIdentityLookup } from '@/lib/auth/external-identity-lookup'
import { readEptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptAction } from '@/lib/auth/require-authenticated-action'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'
import { createMembershipActionHandlers } from '@/lib/memberships/membership-action-handlers'

const CURRENT_TEAM_ID = 'team_1'

const runtime = createMembershipServerActionRuntime({
  db,
  createId: randomUUID,
})

const handlers = createMembershipActionHandlers({
  teamId: CURRENT_TEAM_ID,
  runtime,
  revalidatePath,
})

const economicPolicyBoundary = createH6EconomicAuthorizationBoundary({
  resolveActiveTeam: (userId) => createActiveTeamNextServerContext().resolve(userId),
  loadMemberships: (userId, teamId) => createH4aNextServerEvidenceSource().loadMemberships(userId, teamId),
  resolveResourceTeam: async (resourceId, teamId) => {
    if (resourceId !== '__active_team_policy__') return null
    const active = db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).get()
    return active && !active.isDeleted ? active.id : null
  },
})

const configureAuthorizedPolicy = createH6PolicyAction({
  authenticate: async () => {
    const supabase = await createSupabaseServerClient()
    const lookup = createExternalIdentityLookup()
    return requireAuthenticatedEptAction({
      readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
    })
  },
  authorize: (access, request) => economicPolicyBoundary.authorize(access, request),
  configure: (teamId, input) => runtime.configureTeamEconomicPolicy({ ...input, teamId }),
  revalidate: () => revalidatePath('/dashboard/membership'),
  now: () => new Date().toISOString(),
})

export async function configureTeamEconomicPolicyAction(input: {
  effectiveFrom: string
  defaultMonthlyAmountMinor: number
  currency: string
  ordinaryDueDay: number
}) {
  return configureAuthorizedPolicy(input)
}

export async function applyInitialAthleteBillingTermsAction(input: {
  athleteId: string
  effectiveFrom: string
  locale: 'es' | 'en'
}) {
  return handlers.applyInitialAthleteBillingTerms(input)
}

export async function changeAthleteBillingTermsAction(input: {
  athleteId: string
  effectiveFrom: string
  monthlyAmountMinor: number
  currency: string
  locale: 'es' | 'en'
}) {
  return handlers.changeAthleteBillingTerms(input)
}


export async function applyGlobalDueDateExceptionAction(input: {
  year: number
  month: number
  dueDate: string
  reason: string
  locale: 'es' | 'en'
}) {
  return handlers.applyGlobalDueDateException(input)
}


export async function applyMonthlyChargeReductionAction(input: {
  monthlyChargeId: string
  athleteId: string
  year: number
  month: number
  reductionAmountMinor: number
  reason: string
  locale: 'es' | 'en'
}) {
  return handlers.applyMonthlyChargeReduction(input)
}

export async function applyMonthlyChargeExtensionAction(input: {
  monthlyChargeId: string
  athleteId: string
  year: number
  month: number
  extendedDueDate: string | null
  reason: string
  locale: 'es' | 'en'
}) {
  return handlers.applyMonthlyChargeExtension(input)
}


export async function materializeTeamMonthlyChargesAction(input: {
  year: number
  month: number
  locale: 'es' | 'en'
}) {
  return handlers.materializeTeamMonthlyCharges(input)
}


export async function registerManualPaymentAction(input: {
  athleteId: string
  monthlyChargeId: string
  amountMinor: number
  paymentMethod: 'cash' | 'bank_transfer'
  paidAt: string
  locale: 'es' | 'en'
}) {
  return handlers.registerManualPayment(input)
}


export async function correctManualPaymentAction(input: {
  athleteId: string
  monthlyChargeId: string
  paymentId: string
  amountMinor: number
  paymentMethod: 'cash' | 'bank_transfer'
  paidAt: string
  locale: 'es' | 'en'
}) {
  return handlers.correctManualPayment(input)
}

export async function voidManualPaymentAction(input: {
  athleteId: string
  monthlyChargeId: string
  paymentId: string
  locale: 'es' | 'en'
}) {
  return handlers.voidManualPayment(input)
}
