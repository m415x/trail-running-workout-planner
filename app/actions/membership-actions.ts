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
