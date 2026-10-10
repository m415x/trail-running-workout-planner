import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { athleteProfiles, monthlyCharges, paymentRevisions } from '@/db/schema'
import { evaluateH6PriorDebt, h6BuenosAiresCivilDate } from './h6-prior-debt-self-guard'
import { projectH6TeamDebtSnapshot } from './h6-debt-reversal-isolation'

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
        athleteProfileId: monthlyCharges.athleteId,
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
        isCurrent: paymentRevisions.isCurrent,
      }).from(paymentRevisions).where(and(
        inArray(paymentRevisions.monthlyChargeId, charges.map((charge) => charge.id)),
        eq(paymentRevisions.isCurrent, true),
        eq(paymentRevisions.isDeleted, false),
      )).all() : []
      return projectH6TeamDebtSnapshot({
        teamId,
        athleteProfileId,
        charges: charges.map((charge) => ({ ...charge, teamId })),
        revisions,
      })
    },
  })
}
