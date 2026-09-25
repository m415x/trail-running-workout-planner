export type CurrencyCode = string

export type TeamEconomicPolicy = {
  id: string
  teamId: string
  defaultMonthlyAmountMinor: number
  currency: CurrencyCode
  ordinaryDueDay: number
  effectiveFrom: string
  effectiveUntil: string | null
}

export type AthleteBillingTerms = {
  id: string
  athleteId: string
  monthlyAmountMinor: number
  currency: CurrencyCode
  effectiveFrom: string
  effectiveUntil: string | null
}

export type MonthlyChargeCandidate = {
  athleteId: string
  billingTermsId: string
  year: number
  month: number
  baseAmountMinor: number
  amountDueMinor: number
  currency: CurrencyCode
  baseDueDate: string
  effectiveDueDate: string
}

function parseDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`)
  return date
}

function monthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1))
}

function nextMonthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1))
}

function intersectsMonth(terms: AthleteBillingTerms, year: number, month: number): boolean {
  const start = parseDate(terms.effectiveFrom)
  const end = terms.effectiveUntil ? parseDate(terms.effectiveUntil) : null
  const periodStart = monthStart(year, month)
  const periodEnd = nextMonthStart(year, month)

  return start < periodEnd && (end === null || end > periodStart)
}

function formatDate(year: number, month: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const safeDay = Math.min(day, lastDay)

  return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
}

export function createAthleteBillingTerms(input: {
  id: string
  athleteId: string
  policy: TeamEconomicPolicy
  effectiveFrom: string
  effectiveUntil?: string | null
}): AthleteBillingTerms {
  return {
    id: input.id,
    athleteId: input.athleteId,
    monthlyAmountMinor: input.policy.defaultMonthlyAmountMinor,
    currency: input.policy.currency,
    effectiveFrom: input.effectiveFrom,
    effectiveUntil: input.effectiveUntil ?? null,
  }
}

export function replaceAthleteBillingTerms(input: {
  current: AthleteBillingTerms
  replacementId: string
  effectiveFrom: string
  monthlyAmountMinor: number
  currency: CurrencyCode
}): {
  current: AthleteBillingTerms
  replacement: AthleteBillingTerms
} {
  const replacementStart = parseDate(input.effectiveFrom)

  if (replacementStart.getUTCDate() !== 1) {
    throw new Error('Ordinary billing terms replacement must start on a monthly boundary')
  }

  if (replacementStart <= parseDate(input.current.effectiveFrom)) {
    throw new Error('Replacement billing terms must start after the current terms')
  }

  return {
    current: {
      ...input.current,
      effectiveUntil: input.effectiveFrom,
    },
    replacement: {
      id: input.replacementId,
      athleteId: input.current.athleteId,
      monthlyAmountMinor: input.monthlyAmountMinor,
      currency: input.currency,
      effectiveFrom: input.effectiveFrom,
      effectiveUntil: null,
    },
  }
}

export function createMonthlyChargeCandidate(input: {
  terms: AthleteBillingTerms[]
  policy: TeamEconomicPolicy
  year: number
  month: number
}): MonthlyChargeCandidate | null {
  const matchingTerms = input.terms.filter((terms) => intersectsMonth(terms, input.year, input.month))

  if (matchingTerms.length === 0) return null

  if (matchingTerms.length > 1) {
    throw new Error('More than one billing terms can claim the same athlete month')
  }

  const terms = matchingTerms[0]
  if (!terms) return null

  const dueDate = formatDate(input.year, input.month, input.policy.ordinaryDueDay)

  return {
    athleteId: terms.athleteId,
    billingTermsId: terms.id,
    year: input.year,
    month: input.month,
    baseAmountMinor: terms.monthlyAmountMinor,
    amountDueMinor: terms.monthlyAmountMinor,
    currency: terms.currency,
    baseDueDate: dueDate,
    effectiveDueDate: dueDate,
  }
}


function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function nextMonth(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
}

function policyForMonth(
  policies: TeamEconomicPolicy[],
  year: number,
  month: number,
): TeamEconomicPolicy {
  const date = monthStart(year, month)
  const matching = policies.filter((policy) => {
    const start = parseDate(policy.effectiveFrom)
    const end = policy.effectiveUntil ? parseDate(policy.effectiveUntil) : null
    return start <= date && (end === null || date < end)
  })

  if (matching.length !== 1) {
    throw new Error('Exactly one team economic policy must apply to the materialized month')
  }

  return matching[0]!
}

export function materializeMonthlyChargesThrough(input: {
  terms: AthleteBillingTerms[]
  policies: TeamEconomicPolicy[]
  existingCharges: MonthlyChargeCandidate[]
  through: { year: number; month: number }
}): MonthlyChargeCandidate[] {
  if (input.terms.length === 0) return [...input.existingCharges]

  const athleteIds = new Set(input.terms.map((terms) => terms.athleteId))
  if (athleteIds.size !== 1) {
    throw new Error('Monthly materialization requires billing terms for exactly one athlete')
  }

  const firstTermsStart = input.terms
    .map((terms) => parseDate(terms.effectiveFrom))
    .sort((a, b) => a.getTime() - b.getTime())[0]!

  let cursor = {
    year: firstTermsStart.getUTCFullYear(),
    month: firstTermsStart.getUTCMonth() + 1,
  }

  const targetKey = monthKey(input.through.year, input.through.month)
  const byMonth = new Map(
    input.existingCharges.map((charge) => [monthKey(charge.year, charge.month), charge]),
  )

  while (monthKey(cursor.year, cursor.month) <= targetKey) {
    const key = monthKey(cursor.year, cursor.month)

    if (!byMonth.has(key)) {
      const matchingTerms = input.terms.filter((terms) =>
        intersectsMonth(terms, cursor.year, cursor.month),
      )

      if (matchingTerms.length > 1) {
        throw new Error('More than one billing terms can claim the same athlete month')
      }

      const terms = matchingTerms[0]
      if (terms) {
        const policy = policyForMonth(input.policies, cursor.year, cursor.month)
        const candidate = createMonthlyChargeCandidate({
          terms: [terms],
          policy,
          year: cursor.year,
          month: cursor.month,
        })

        if (candidate) byMonth.set(key, candidate)
      }
    }

    cursor = nextMonth(cursor.year, cursor.month)
  }

  return [...byMonth.values()].sort(
    (a, b) => a.year - b.year || a.month - b.month,
  )
}
