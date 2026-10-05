/**
 * Pure consumer boundary for an authoritative, team-scoped H4/H5 snapshot.
 * The injected reader owns persistence scoping and H4/H5 derivation.
 * No browser clock, mutable billing state or Profile history dependency.
 */
export type AthleteHomeEconomicAccount = {
  available: boolean
  blockedForPriorDebt: boolean
  charges: readonly {
    year: number
    month: number
    status: 'settled' | 'pending' | 'overdue'
    remainingMinor: number
  }[]
}

export type AthleteHomeEconomicReadInput = {
  teamId: string
  athleteId: string
  cutoffDate: string
}

export type AthleteHomeEconomicSummary = {
  currentCharge: {
    status: 'settled' | 'pending' | 'overdue'
    remainingMinor: number
  } | null
  blockedForPriorDebt: boolean
  available: boolean
}

const unknown: AthleteHomeEconomicSummary = {
  currentCharge: null,
  blockedForPriorDebt: false,
  available: false,
}

export function createAthleteHomeEconomicReader({
  readAccount,
}: {
  readAccount: (input: AthleteHomeEconomicReadInput) => Promise<AthleteHomeEconomicAccount>
}) {
  return async (input: AthleteHomeEconomicReadInput): Promise<AthleteHomeEconomicSummary> => {
    if (
      !input.teamId.trim()
      || !input.athleteId.trim()
      || !/^\d{4}-\d{2}-\d{2}$/.test(input.cutoffDate)
    ) {
      return { ...unknown }
    }

    try {
      const account = await readAccount(input)
      if (!account.available) return { ...unknown }

      const [year, month] = input.cutoffDate.split('-').map(Number)
      const current = account.charges.find(charge => charge.year === year && charge.month === month)

      return {
        currentCharge: current
          ? { status: current.status, remainingMinor: current.remainingMinor }
          : null,
        blockedForPriorDebt: account.blockedForPriorDebt,
        available: true,
      }
    } catch {
      return { ...unknown }
    }
  }
}
