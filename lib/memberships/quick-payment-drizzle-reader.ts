import { and, eq, inArray } from 'drizzle-orm'

import { athleteProfiles, monthlyCharges, paymentRevisions } from '@/db/schema'
import { projectQuickPaymentBatch } from './quick-payment-batch-projection'

type Row = Record<string, unknown>
type JoinedQuery = {
  innerJoin: (table: unknown, condition: unknown) => JoinedQuery
  where: (condition: unknown) => Promise<Row[]>
}
type Query = {
  select: () => { from: (table: unknown) => JoinedQuery }
}

function chargeRow(row: Row): Row {
  return (row.monthly_charges ?? row.monthlyCharges ?? row) as Row
}

function paymentRow(row: Row): Row {
  return (row.payment_revisions ?? row.paymentRevisions ?? row) as Row
}

/**
 * Two scoped SQL statements irrespective of the number of requested athletes:
 * charges joined to their non-deleted AthleteProfile and effective payment
 * revisions joined back through charges and AthleteProfile.
 * No writes, materialization of charges, or reinterpretation of H4/H5.
 */
export function createDrizzleQuickPaymentBatchReader(db: unknown) {
  const client = db as Query
  return async function read(input: {
    teamId: string
    athleteIds: readonly string[]
    cutoffDate: string
  }) {
    if (input.athleteIds.length === 0) return []
    if (new Set(input.athleteIds).size !== input.athleteIds.length) {
      throw new Error('Quick-payment scope has duplicate athlete identities')
    }

    const chargeRows = await client.select()
      .from(monthlyCharges)
      .innerJoin(athleteProfiles, and(
        eq(athleteProfiles.id, monthlyCharges.athleteId),
        eq(athleteProfiles.teamId, input.teamId),
        eq(athleteProfiles.isDeleted, false),
      ))
      .where(and(
        inArray(monthlyCharges.athleteId, [...input.athleteIds]),
        eq(monthlyCharges.isDeleted, false),
      ))

    const charges = chargeRows.map((row) => {
      const source = chargeRow(row)
      return {
        id: String(source.id),
        athleteId: String(source.athleteId),
        billingTermsId: String(source.billingTermsId),
        year: Number(source.year),
        month: Number(source.month),
        baseAmountMinor: Number(source.baseAmountMinor),
        amountDueMinor: Number(source.amountDueMinor),
        currency: String(source.currency),
        baseDueDate: String(source.baseDueDate),
        effectiveDueDate: String(source.effectiveDueDate),
      }
    })

    // A second grouped query, not one query per charge or athlete.
    const chargeIds = charges.map((charge) => charge.id)
    if (chargeIds.length === 0) {
      return projectQuickPaymentBatch({
        requestedAthleteIds: input.athleteIds,
        cutoffDate: input.cutoffDate,
        charges: [],
        paymentRevisions: [],
      })
    }

    const revisionRows = await client.select()
      .from(paymentRevisions)
      .innerJoin(monthlyCharges, and(
        eq(monthlyCharges.id, paymentRevisions.monthlyChargeId),
        eq(monthlyCharges.isDeleted, false),
      ))
      .innerJoin(athleteProfiles, and(
        eq(athleteProfiles.id, monthlyCharges.athleteId),
        eq(athleteProfiles.teamId, input.teamId),
        eq(athleteProfiles.isDeleted, false),
      ))
      .where(and(
        inArray(paymentRevisions.monthlyChargeId, chargeIds),
        eq(paymentRevisions.isDeleted, false),
      )) as Row[]

    const paymentHistory = revisionRows.map((row) => {
      const revision = paymentRow(row)
      return {
        revisionId: String(revision.id ?? revision.revisionId),
        paymentId: String(revision.paymentId),
        monthlyChargeId: String(revision.monthlyChargeId),
        amountMinor: Number(revision.amountMinor),
        paymentMethod: String(revision.paymentMethod) as 'cash' | 'bank_transfer',
        paidAt: String(revision.paidAt),
        voided: Boolean(revision.voided),
        isCurrent: Boolean(revision.isCurrent),
      }
    })

    return projectQuickPaymentBatch({
      requestedAthleteIds: input.athleteIds,
      cutoffDate: input.cutoffDate,
      charges,
      paymentRevisions: paymentHistory,
    })
  }
}
