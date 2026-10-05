/**
 * Application read boundary for quick payments.
 *
 * Repositories must derive H4/H5 facts from persisted, team-scoped billing
 * records. This adapter never generates charges or writes economic facts.
 */
export type QuickPaymentReadCharge = {
  id: string
  year: number
  month: number
  currency: string
  remainingMinor: number
  status: 'settled' | 'pending' | 'overdue'
}

export type QuickPaymentReadSummary<TCharge extends QuickPaymentReadCharge = QuickPaymentReadCharge> = {
  athleteId: string
  charges: TCharge[]
  blockedForPriorDebt: boolean
}

export type QuickPaymentReadRepository<TCharge extends QuickPaymentReadCharge> = {
  listTeamAthleteSummaries: (scope: {
    teamId: string
    athleteIds: readonly string[]
  }) => Promise<QuickPaymentReadSummary<TCharge>[]>
  getTeamAthleteCharges: (scope: {
    teamId: string
    athleteId: string
  }) => Promise<QuickPaymentReadSummary<TCharge>>
}

/**
 * Rejects repository rows outside the explicitly requested athlete scope.
 * The repository remains responsible for enforcing the team boundary against
 * persisted athlete ownership; this check is defense in depth, not auth.
 */
export function createQuickPaymentReadService<TCharge extends QuickPaymentReadCharge>(
  repository: QuickPaymentReadRepository<TCharge>,
) {
  return {
    async list(scope: { teamId: string; athleteIds: readonly string[] }) {
      const requested = new Set(scope.athleteIds)
      const summaries = await repository.listTeamAthleteSummaries(scope)
      const encountered = new Set<string>()

      for (const summary of summaries) {
        if (!requested.has(summary.athleteId) || encountered.has(summary.athleteId)) {
          throw new Error('Quick payment batch result violates requested athlete scope')
        }
        encountered.add(summary.athleteId)
      }

      return summaries.map((summary) => ({
        athleteId: summary.athleteId,
        hasEligibleCharge: summary.charges.some((charge) =>
          Number.isSafeInteger(charge.remainingMinor) && charge.remainingMinor > 0,
        ),
        blockedForPriorDebt: summary.blockedForPriorDebt,
      }))
    },
    async detail(scope: { teamId: string; athleteId: string }) {
      const summary = await repository.getTeamAthleteCharges(scope)
      if (summary.athleteId !== scope.athleteId) {
        throw new Error('Quick payment detail result violates requested athlete scope')
      }
      return summary
    },
  }
}
