'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import { and, eq } from 'drizzle-orm'
import { teams, athleteProfiles, monthlyCharges } from '@/db/schema'
import { createActiveTeamNextServerContext } from '@/lib/authorization/active-team-next-server'
import { createH4aNextServerEvidenceSource } from '@/lib/authorization/h4a-next-server-authorization'
import { createH6EconomicAuthorizationBoundary } from '@/lib/authorization/h6-economic-authorization'
import { createH6PolicyAction } from '@/lib/memberships/h6-policy-action'
import { createH6TermsAndMaterializationActions } from '@/lib/memberships/h6-terms-materialization-actions'
import { createH6EconomicExceptionActions } from '@/lib/memberships/h6-economic-exception-actions'
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
    if (resourceId !== '__active_team_policy__' && resourceId !== '__active_team_economy__') return null
    const active = db.select({ id: teams.id, isDeleted: teams.isDeleted }).from(teams).where(eq(teams.id, teamId)).get()
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

const authorizedTermsAndMaterialization = createH6TermsAndMaterializationActions({
  authenticate: async () => {
    const supabase = await createSupabaseServerClient()
    const lookup = createExternalIdentityLookup()
    return requireAuthenticatedEptAction({
      readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
    })
  },
  authorize: (access, request) => economicPolicyBoundary.authorize(access, request),
  ownsAthlete: async (teamId, athleteId) => {
    const row = db.select({ id: athleteProfiles.id }).from(athleteProfiles).where(and(
      eq(athleteProfiles.id, athleteId),
      eq(athleteProfiles.teamId, teamId),
      eq(athleteProfiles.isDeleted, false),
    )).get()
    return Boolean(row)
  },
  initializeTerms: (teamId, athleteId, effectiveFrom) =>
    runtime.applyInitialAthleteBillingTerms({ teamId, athleteId, effectiveFrom }),
  changeTerms: (teamId, athleteId, input) =>
    runtime.changeAthleteBillingTerms({ teamId, athleteId, ...input }),
  materialize: (teamId, input) => runtime.materializeTeamMonthlyCharges({ teamId, ...input }),
  revalidate: revalidatePath,
  now: () => new Date().toISOString(),
})

export async function applyInitialAthleteBillingTermsAction(input: {
  athleteId: string
  effectiveFrom: string
  locale: 'es' | 'en'
}) {
  return authorizedTermsAndMaterialization.applyInitial(input)
}

export async function changeAthleteBillingTermsAction(input: {
  athleteId: string
  effectiveFrom: string
  monthlyAmountMinor: number
  currency: string
  locale: 'es' | 'en'
}) {
  return authorizedTermsAndMaterialization.change(input)
}


const authorizedEconomicExceptions = createH6EconomicExceptionActions({
  authenticate: async () => {
    const supabase = await createSupabaseServerClient()
    const lookup = createExternalIdentityLookup()
    return requireAuthenticatedEptAction({
      readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
    })
  },
  authorize: (access, request) => economicPolicyBoundary.authorize(access, request),
  ownsCharge: async (teamId, athleteId, chargeId, year, month) => {
    const row = db.select({ id: monthlyCharges.id }).from(monthlyCharges)
      .innerJoin(athleteProfiles, eq(monthlyCharges.athleteId, athleteProfiles.id))
      .where(and(
        eq(monthlyCharges.id, chargeId),
        eq(monthlyCharges.athleteId, athleteId),
        eq(monthlyCharges.year, year),
        eq(monthlyCharges.month, month),
        eq(monthlyCharges.isDeleted, false),
        eq(athleteProfiles.teamId, teamId),
        eq(athleteProfiles.isDeleted, false),
      )).get()
    return Boolean(row)
  },
  globalDueDate: (teamId, input) => runtime.applyGlobalDueDateException({ ...input, teamId }),
  reduce: (teamId, input) => runtime.applyMonthlyChargeReduction({
    teamId,
    athleteId: input.athleteId,
    monthlyChargeId: input.monthlyChargeId,
    year: input.year,
    month: input.month,
    reductionAmountMinor: input.reductionAmountMinor,
    reason: input.reason,
  }),
  extend: (teamId, input) => runtime.applyMonthlyChargeExtension({
    teamId,
    athleteId: input.athleteId,
    monthlyChargeId: input.monthlyChargeId,
    year: input.year,
    month: input.month,
    extendedDueDate: input.extendedDueDate,
    reason: input.reason,
  }),
  revalidate: revalidatePath,
  now: () => new Date().toISOString(),
})

export async function applyGlobalDueDateExceptionAction(input: {
  year: number
  month: number
  dueDate: string
  reason: string
  locale: 'es' | 'en'
}) {
  return authorizedEconomicExceptions.global(input)
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
  return authorizedEconomicExceptions.reduction(input)
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
  return authorizedEconomicExceptions.extension(input)
}


export async function materializeTeamMonthlyChargesAction(input: {
  year: number
  month: number
  locale: 'es' | 'en'
}) {
  return authorizedTermsAndMaterialization.materialize(input)
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
