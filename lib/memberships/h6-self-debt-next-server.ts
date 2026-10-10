import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { athleteProfiles, monthlyCharges, paymentRevisions } from '@/db/schema'
import { evaluateH6PriorDebt, h6BuenosAiresCivilDate } from './h6-prior-debt-self-guard'

/** Persistence-owned evidence: payment corrections/voids are projected from current revisions only. */
export async function evaluateH6SelfDebtFromPersistence(subject: {
  teamId: string
  athleteProfileId: string
}) {
  return evaluateH6PriorDebt({
    ...subject,
    cutoffDate: h6BuenosAiresCivilDate(),
    loadCharges: async (teamId, athleteProfileId) => {
      const profile = db.select({ id: athleteProfiles.id }).from(athleteProfiles).where(and(
        eq(athleteProfiles.id, athleteProfileId),
        eq(athleteProfiles.teamId, teamId),
        eq(athleteProfiles.isDeleted, false),
      )).get()
      if (!profile) return null
      const charges = db.select({
        id: monthlyCharges.id,
        year: monthlyCharges.year,
        month: monthlyCharges.month,
        amountDueMinor: monthlyCharges.amountDueMinor,
        effectiveDueDate: monthlyCharges.effectiveDueDate,
      }).from(monthlyCharges).where(and(
        eq(monthlyCharges.athleteId, athleteProfileId),
        eq(monthlyCharges.isDeleted, false),
      )).all()
      const revisions = charges.length ? db.select({
        monthlyChargeId: paymentRevisions.monthlyChargeId,
        paymentId: paymentRevisions.paymentId,
        amountMinor: paymentRevisions.amountMinor,
        voided: paymentRevisions.voided,
      }).from(paymentRevisions).where(and(
        inArray(paymentRevisions.monthlyChargeId, charges.map((charge) => charge.id)),
        eq(paymentRevisions.isCurrent, true),
        eq(paymentRevisions.isDeleted, false),
      )).all() : []
      const paymentsByCharge = new Map<string, number>()
      const observedPaymentIds = new Set<string>()
      for (const revision of revisions) {
        if (observedPaymentIds.has(revision.paymentId)) return null
        observedPaymentIds.add(revision.paymentId)
        if (!revision.voided) {
          const sum = (paymentsByCharge.get(revision.monthlyChargeId) ?? 0) + revision.amountMinor
          if (!Number.isSafeInteger(sum)) return null
          paymentsByCharge.set(revision.monthlyChargeId, sum)
        }
      }
      return charges.map((charge) => {
        const remainingMinor = charge.amountDueMinor - (paymentsByCharge.get(charge.id) ?? 0)
        return {
          year: charge.year,
          month: charge.month,
          remainingMinor,
          effectiveDueDate: charge.effectiveDueDate,
        }
      })
    },
  })
}
