'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import { createMembershipServerActionRuntime } from '@/lib/memberships/billing-server-action-runtime'
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

export async function configureTeamEconomicPolicyAction(input: {
  effectiveFrom: string
  defaultMonthlyAmountMinor: number
  currency: string
  ordinaryDueDay: number
}) {
  return handlers.configureTeamEconomicPolicy(input)
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
  extendedDueDate: string
  reason: string
  locale: 'es' | 'en'
}) {
  return handlers.applyMonthlyChargeExtension(input)
}
