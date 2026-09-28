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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid date: ${value}`)
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid date: ${value}`)
  }
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

export function createTeamEconomicPolicy(input: {
  id: string
  teamId: string
  defaultMonthlyAmountMinor: number
  currency: CurrencyCode
  ordinaryDueDay: number
  effectiveFrom: string
}): TeamEconomicPolicy {
  const start = parseDate(input.effectiveFrom)

  if (start.getUTCDate() !== 1) {
    throw new Error('Team economic policy must start on a monthly boundary')
  }

  if (!Number.isSafeInteger(input.defaultMonthlyAmountMinor) || input.defaultMonthlyAmountMinor <= 0) {
    throw new Error('Default monthly amount must be a positive integer in minor units')
  }

  if (!Number.isInteger(input.ordinaryDueDay) || input.ordinaryDueDay < 1 || input.ordinaryDueDay > 31) {
    throw new Error('Ordinary due day must be an integer between 1 and 31')
  }

  return {
    ...input,
    effectiveUntil: null,
  }
}

export function replaceTeamEconomicPolicy(input: {
  current: TeamEconomicPolicy
  replacementId: string
  effectiveFrom: string
  defaultMonthlyAmountMinor: number
  currency: CurrencyCode
  ordinaryDueDay: number
}): {
  current: TeamEconomicPolicy
  replacement: TeamEconomicPolicy
} {
  const replacementStart = parseDate(input.effectiveFrom)

  if (replacementStart.getUTCDate() !== 1) {
    throw new Error('Team economic policy replacement must start on a monthly boundary')
  }

  if (replacementStart <= parseDate(input.current.effectiveFrom)) {
    throw new Error('Replacement team economic policy must start after the current policy')
  }

  const replacement = createTeamEconomicPolicy({
    id: input.replacementId,
    teamId: input.current.teamId,
    defaultMonthlyAmountMinor: input.defaultMonthlyAmountMinor,
    currency: input.currency,
    ordinaryDueDay: input.ordinaryDueDay,
    effectiveFrom: input.effectiveFrom,
  })

  return {
    current: {
      ...input.current,
      effectiveUntil: input.effectiveFrom,
    },
    replacement,
  }
}

export function applyAthleteBillingTerms(input: {
  id: string
  athleteId: string
  policy: TeamEconomicPolicy
  effectiveFrom: string
  effectiveUntil?: string | null
}): AthleteBillingTerms {
  return createAthleteBillingTerms(input)
}

export function changeAthleteBillingTerms(input: {
  current: AthleteBillingTerms
  replacementId: string
  effectiveFrom: string
  monthlyAmountMinor: number
  currency: CurrencyCode
}): {
  current: AthleteBillingTerms
  replacement: AthleteBillingTerms
} {
  return replaceAthleteBillingTerms(input)
}

export function createAthleteBillingTerms(input: {
  id: string
  athleteId: string
  policy: TeamEconomicPolicy
  effectiveFrom: string
  effectiveUntil?: string | null
}): AthleteBillingTerms {
  if (!Number.isSafeInteger(input.policy.defaultMonthlyAmountMinor) || input.policy.defaultMonthlyAmountMinor <= 0) {
    throw new Error('Monthly amount must be a positive integer in minor units')
  }

  const start = parseDate(input.effectiveFrom)
  if (input.effectiveUntil && parseDate(input.effectiveUntil) <= start) {
    throw new Error('effectiveUntil must be after effectiveFrom')
  }

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
  if (!Number.isInteger(input.policy.ordinaryDueDay) || input.policy.ordinaryDueDay < 1 || input.policy.ordinaryDueDay > 31) {
    throw new Error('Ordinary due day must be an integer between 1 and 31')
  }

  const matchingTerms = input.terms.filter((terms) => intersectsMonth(terms, input.year, input.month))

  if (matchingTerms.length === 0) return null

  if (matchingTerms.length > 1) {
    throw new Error('More than one billing terms can claim the same athlete month')
  }

  const terms = matchingTerms[0]
  if (!terms) return null

  const ordinaryDueDate = formatDate(input.year, input.month, input.policy.ordinaryDueDay)
  const termsStart = parseDate(terms.effectiveFrom)
  const isFirstReachedMonth =
    termsStart.getUTCFullYear() === input.year &&
    termsStart.getUTCMonth() + 1 === input.month
  const dueDate =
    isFirstReachedMonth && parseDate(ordinaryDueDate) < termsStart
      ? terms.effectiveFrom
      : ordinaryDueDate

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


export type BillingMaterializationRepository = {
  getBillingTerms: (athleteId: string) => Promise<AthleteBillingTerms[]>
  getTeamEconomicPolicies: (athleteId: string) => Promise<TeamEconomicPolicy[]>
  getMonthlyCharges: (athleteId: string) => Promise<MonthlyChargeCandidate[]>
  insertMonthlyCharges: (charges: MonthlyChargeCandidate[]) => Promise<void>
}

export async function materializeMonthlyCharges(input: {
  athleteId: string
  through: { year: number; month: number }
  repository: BillingMaterializationRepository
}): Promise<MonthlyChargeCandidate[]> {
  const terms = await input.repository.getBillingTerms(input.athleteId)
  const policies = await input.repository.getTeamEconomicPolicies(input.athleteId)
  const existingCharges = await input.repository.getMonthlyCharges(input.athleteId)

  const materialized = materializeMonthlyChargesThrough({
    terms,
    policies,
    existingCharges,
    through: input.through,
  })

  const existingMonths = new Set(
    existingCharges.map(charge => monthKey(charge.year, charge.month)),
  )
  const missingCharges = materialized.filter(
    charge => !existingMonths.has(monthKey(charge.year, charge.month)),
  )

  if (missingCharges.length > 0) {
    await input.repository.insertMonthlyCharges(missingCharges)
  }

  return missingCharges
}


export type AthleteBillingSnapshotRepository = {
  athleteBelongsToTeam: (teamId: string, athleteId: string) => Promise<boolean>
  getBillingTerms: (athleteId: string) => Promise<AthleteBillingTerms[]>
  getMonthlyCharges: (athleteId: string) => Promise<MonthlyChargeCandidate[]>
}

export async function getAthleteBillingSnapshot(input: {
  teamId: string
  athleteId: string
  repository: AthleteBillingSnapshotRepository
}): Promise<{
  terms: AthleteBillingTerms[]
  charges: MonthlyChargeCandidate[]
}> {
  const belongsToTeam = await input.repository.athleteBelongsToTeam(
    input.teamId,
    input.athleteId,
  )

  if (!belongsToTeam) {
    throw new Error('Athlete does not belong to the requested team')
  }

  const terms = await input.repository.getBillingTerms(input.athleteId)
  const charges = await input.repository.getMonthlyCharges(input.athleteId)

  return { terms, charges }
}


export type GlobalDueDateExceptionRevision = {
  id: string
  teamId: string
  year: number
  month: number
  dueDate: string
  reason: string
  isCurrent: boolean
}

export type MonthlyChargeReductionRevision = {
  id: string
  athleteId: string
  year: number
  month: number
  reductionAmountMinor: number
  reason: string
  isCurrent: boolean
}

export type MonthlyChargeExtensionRevision = {
  id: string
  athleteId: string
  year: number
  month: number
  extendedDueDate: string | null
  reason: string
  isCurrent: boolean
}

function requireReason(reason: string): string {
  const normalized = reason.trim()
  if (!normalized) throw new Error('H2 economic fact requires a reason')
  return normalized
}

function sameChargeRevision(
  revision: { athleteId: string; year: number; month: number },
  charge: MonthlyChargeCandidate,
): boolean {
  return revision.athleteId === charge.athleteId
    && revision.year === charge.year
    && revision.month === charge.month
}

export function applyGlobalDueDateException(input: {
  revisions: GlobalDueDateExceptionRevision[]
  id: string
  teamId: string
  year: number
  month: number
  dueDate: string
  reason: string
}): GlobalDueDateExceptionRevision[] {
  if (!Number.isInteger(input.year) || input.year < 1 || !Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    throw new Error('Global due-date exception requires a valid year/month period')
  }
  const dueDate = parseDate(input.dueDate)
  if (dueDate.getUTCFullYear() !== input.year || dueDate.getUTCMonth() + 1 !== input.month) {
    throw new Error('Global due-date exception date must belong to the same month period')
  }
  const reason = requireReason(input.reason)
  if (input.revisions.some(revision =>
    revision.teamId !== input.teamId
    || revision.year !== input.year
    || revision.month !== input.month
  )) {
    throw new Error('Global due-date revision stream must keep one team/month identity')
  }
  const current = input.revisions.find(revision =>
    revision.isCurrent
    && revision.teamId === input.teamId
    && revision.year === input.year
    && revision.month === input.month,
  )

  if (current?.dueDate === input.dueDate && current.reason === reason) {
    return input.revisions
  }

  return [
    ...input.revisions.map(revision =>
      revision.isCurrent
      && revision.teamId === input.teamId
      && revision.year === input.year
      && revision.month === input.month
        ? { ...revision, isCurrent: false }
        : revision,
    ),
    {
      id: input.id,
      teamId: input.teamId,
      year: input.year,
      month: input.month,
      dueDate: input.dueDate,
      reason,
      isCurrent: true,
    },
  ]
}

export function applyMonthlyChargeReduction(input: {
  revisions: MonthlyChargeReductionRevision[]
  id: string
  charge: MonthlyChargeCandidate
  reductionAmountMinor: number
  reason: string
}): MonthlyChargeReductionRevision[] {
  const reason = requireReason(input.reason)
  if (input.revisions.some(revision => !sameChargeRevision(revision, input.charge))) {
    throw new Error('Reduction revision stream must keep one charge identity')
  }
  if (
    !Number.isSafeInteger(input.reductionAmountMinor)
    || input.reductionAmountMinor < 0
    || input.reductionAmountMinor > input.charge.baseAmountMinor
  ) {
    throw new Error('Reduction amount must be an integer between zero and the base amount')
  }

  const current = input.revisions.find(revision =>
    revision.isCurrent && sameChargeRevision(revision, input.charge),
  )
  if (current?.reductionAmountMinor === input.reductionAmountMinor && current.reason === reason) {
    return input.revisions
  }

  return [
    ...input.revisions.map(revision =>
      revision.isCurrent && sameChargeRevision(revision, input.charge)
        ? { ...revision, isCurrent: false }
        : revision,
    ),
    {
      id: input.id,
      athleteId: input.charge.athleteId,
      year: input.charge.year,
      month: input.charge.month,
      reductionAmountMinor: input.reductionAmountMinor,
      reason,
      isCurrent: true,
    },
  ]
}

export function applyMonthlyChargeExtension(input: {
  revisions: MonthlyChargeExtensionRevision[]
  id: string
  charge: MonthlyChargeCandidate
  extendedDueDate: string | null
  reason: string
}): MonthlyChargeExtensionRevision[] {
  const reason = requireReason(input.reason)
  if (input.revisions.some(revision => !sameChargeRevision(revision, input.charge))) {
    throw new Error('Extension revision stream must keep one charge identity')
  }
  if (input.extendedDueDate !== null && parseDate(input.extendedDueDate) <= parseDate(input.charge.baseDueDate)) {
    throw new Error('Extension due date must be after the current base due date')
  }

  const current = input.revisions.find(revision =>
    revision.isCurrent && sameChargeRevision(revision, input.charge),
  )
  if (current?.extendedDueDate === input.extendedDueDate && current.reason === reason) {
    return input.revisions
  }

  return [
    ...input.revisions.map(revision =>
      revision.isCurrent && sameChargeRevision(revision, input.charge)
        ? { ...revision, isCurrent: false }
        : revision,
    ),
    {
      id: input.id,
      athleteId: input.charge.athleteId,
      year: input.charge.year,
      month: input.charge.month,
      extendedDueDate: input.extendedDueDate,
      reason,
      isCurrent: true,
    },
  ]
}

export function projectMonthlyChargeWithExceptions(input: {
  charge: MonthlyChargeCandidate
  economicActivationDate?: string
  globalDueDateException: GlobalDueDateExceptionRevision | null
  reductionRevisions: MonthlyChargeReductionRevision[]
  extensionRevisions: MonthlyChargeExtensionRevision[]
}): MonthlyChargeCandidate {
  if (input.globalDueDateException && !input.globalDueDateException.isCurrent) {
    throw new Error('Global due-date projection requires the current revision, not a historical revision')
  }
  if (
    input.globalDueDateException
    && (
      input.globalDueDateException.year !== input.charge.year
      || input.globalDueDateException.month !== input.charge.month
    )
  ) {
    throw new Error('Global due-date exception period must match the charge month identity')
  }
  if (input.reductionRevisions.some(revision => !sameChargeRevision(revision, input.charge))) {
    throw new Error('Reduction revision identity must match the projected charge')
  }
  if (input.extensionRevisions.some(revision => !sameChargeRevision(revision, input.charge))) {
    throw new Error('Extension revision identity must match the projected charge')
  }

  let baseDueDate = input.globalDueDateException?.dueDate ?? input.charge.baseDueDate
  if (
    input.economicActivationDate
    && parseDate(baseDueDate) < parseDate(input.economicActivationDate)
  ) {
    baseDueDate = input.economicActivationDate
  }

  const currentReductions = input.reductionRevisions.filter(revision =>
    revision.isCurrent && sameChargeRevision(revision, input.charge),
  )
  if (currentReductions.length > 1) {
    throw new Error('Ambiguous H2 state: more than one current reduction revision')
  }
  const currentReduction = currentReductions[0]
  const amountDueMinor = input.charge.baseAmountMinor - (currentReduction?.reductionAmountMinor ?? 0)

  const currentExtensions = input.extensionRevisions.filter(revision =>
    revision.isCurrent && sameChargeRevision(revision, input.charge),
  )
  if (currentExtensions.length > 1) {
    throw new Error('Ambiguous H2 state: more than one current extension revision')
  }
  const currentExtension = currentExtensions[0]
  const extendedDueDate = currentExtension?.extendedDueDate ?? null
  const effectiveDueDate = extendedDueDate && parseDate(extendedDueDate) > parseDate(baseDueDate)
    ? extendedDueDate
    : baseDueDate

  return {
    ...input.charge,
    baseAmountMinor: input.charge.baseAmountMinor,
    amountDueMinor,
    baseDueDate,
    effectiveDueDate,
  }
}


export type PaymentMethod = 'cash' | 'bank_transfer'

/**
 * One immutable revision of a logical Payment.
 * Corrections and voids append a new current revision rather than mutating history.
 */
export type PaymentRevision = {
  revisionId: string
  paymentId: string
  monthlyChargeId: string
  amountMinor: number
  paymentMethod: PaymentMethod
  paidAt: string
  voided: boolean
  isCurrent: boolean
}

/**
 * Appends a revision for one logical Payment while preserving prior revisions.
 */
export function applyPaymentRevision(input: {
  revisions: PaymentRevision[]
  revisionId: string
  paymentId: string
  monthlyChargeId: string
  amountMinor: number
  paymentMethod: PaymentMethod
  paidAt: string
  voided: boolean
}): PaymentRevision[] {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error('Payment amount must be a positive integer in minor units')
  }

  parseDate(input.paidAt)

  if (input.revisions.some(revision => revision.paymentId !== input.paymentId)) {
    throw new Error('Payment revision stream must keep one logical Payment identity')
  }

  if (input.revisions.some(revision => revision.monthlyChargeId !== input.monthlyChargeId)) {
    throw new Error('Payment revision stream must keep one MonthlyCharge identity')
  }

  return [
    ...input.revisions.map(revision =>
      revision.isCurrent ? { ...revision, isCurrent: false } : revision,
    ),
    {
      revisionId: input.revisionId,
      paymentId: input.paymentId,
      monthlyChargeId: input.monthlyChargeId,
      amountMinor: input.amountMinor,
      paymentMethod: input.paymentMethod,
      paidAt: input.paidAt,
      voided: input.voided,
      isCurrent: true,
    },
  ]
}

/**
 * Derives paid and remaining amounts for one MonthlyCharge from current effective
 * Payment revisions. It deliberately does not derive H4 account-status states.
 */
export function deriveMonthlyChargePaymentBalance(input: {
  charge: MonthlyChargeCandidate
  monthlyChargeId: string
  paymentRevisions: PaymentRevision[]
}): {
  amountDueMinor: number
  paidMinor: number
  remainingMinor: number
} {
  if (input.paymentRevisions.some(revision => revision.monthlyChargeId !== input.monthlyChargeId)) {
    throw new Error('Payment revision belongs to a different MonthlyCharge identity')
  }

  const byPayment = new Map<string, PaymentRevision[]>()
  for (const revision of input.paymentRevisions) {
    const revisions = byPayment.get(revision.paymentId) ?? []
    revisions.push(revision)
    byPayment.set(revision.paymentId, revisions)
  }

  let paidMinor = 0

  for (const revisions of byPayment.values()) {
    const current = revisions.filter(revision => revision.isCurrent)
    if (current.length > 1) {
      throw new Error('Ambiguous Payment state: more than one current revision')
    }

    const effective = current[0]
    if (effective && !effective.voided) {
      paidMinor += effective.amountMinor
    }
  }

  if (paidMinor > input.charge.amountDueMinor) {
    throw new Error('Effective payments cannot exceed the MonthlyCharge amount due')
  }

  return {
    amountDueMinor: input.charge.amountDueMinor,
    paidMinor,
    remainingMinor: input.charge.amountDueMinor - paidMinor,
  }
}


export type MembershipChargeStatus = 'settled' | 'pending' | 'overdue'

export type MembershipAccountChargeState = {
  id: string
  currency: CurrencyCode
  amountDueMinor: number
  paidMinor: number
  remainingMinor: number
  effectiveDueDate: string
  status: MembershipChargeStatus
}

export type MembershipAccountBalance = {
  currency: CurrencyCode
  amountDueMinor: number
  paidMinor: number
  remainingMinor: number
}

/**
 * Derives the H4 economic account state from persisted H1/H2/H3 facts.
 *
 * The cutoff date is an explicit civil date and is never inferred from the
 * runtime clock or timezone. Monetary totals are grouped by currency so unlike
 * units are never added together.
 */
export function deriveMembershipAccountState(input: {
  cutoffDate: string
  charges: Array<{
    id: string
    charge: MonthlyChargeCandidate
    paymentRevisions: PaymentRevision[]
  }>
}): {
  cutoffDate: string
  charges: MembershipAccountChargeState[]
  balanceByCurrency: MembershipAccountBalance[]
} {
  parseDate(input.cutoffDate)

  const charges = input.charges.map(({ id, charge, paymentRevisions }) => {
    const balance = deriveMonthlyChargePaymentBalance({
      charge,
      monthlyChargeId: id,
      paymentRevisions,
    })

    const status: MembershipChargeStatus = balance.remainingMinor === 0
      ? 'settled'
      : input.cutoffDate <= charge.effectiveDueDate
        ? 'pending'
        : 'overdue'

    return {
      id,
      currency: charge.currency,
      amountDueMinor: balance.amountDueMinor,
      paidMinor: balance.paidMinor,
      remainingMinor: balance.remainingMinor,
      effectiveDueDate: charge.effectiveDueDate,
      status,
    }
  })

  const balances = new Map<CurrencyCode, MembershipAccountBalance>()

  for (const charge of charges) {
    const current = balances.get(charge.currency) ?? {
      currency: charge.currency,
      amountDueMinor: 0,
      paidMinor: 0,
      remainingMinor: 0,
    }

    balances.set(charge.currency, {
      currency: charge.currency,
      amountDueMinor: current.amountDueMinor + charge.amountDueMinor,
      paidMinor: current.paidMinor + charge.paidMinor,
      remainingMinor: current.remainingMinor + charge.remainingMinor,
    })
  }

  return {
    cutoffDate: input.cutoffDate,
    charges,
    balanceByCurrency: [...balances.values()].sort((a, b) =>
      a.currency.localeCompare(b.currency),
    ),
  }
}


export type MembershipDebtExperienceCharge = MembershipAccountChargeState & {
  year: number
  month: number
}

/**
 * Derives the H5 functional debt experience from already-derived H4 charge
 * states. H5 never reinterprets due dates, extensions, payments or money.
 *
 * A prior-debt block exists only when a charge belongs to a civil month before
 * the as-of month and H4 has already classified that charge as overdue.
 */
export function deriveMembershipDebtExperience(input: {
  asOfDate: string
  charges: MembershipDebtExperienceCharge[]
}): {
  asOfDate: string
  blockedForPriorDebt: boolean
  blockingChargeIds: string[]
  charges: MembershipDebtExperienceCharge[]
} {
  const asOf = parseDate(input.asOfDate)
  const currentYear = asOf.getUTCFullYear()
  const currentMonth = asOf.getUTCMonth() + 1

  const blockingChargeIds = input.charges
    .filter((charge) => {
      if (!Number.isInteger(charge.year) || charge.year < 1) {
        throw new Error('H5 debt experience requires a valid charge year')
      }
      if (!Number.isInteger(charge.month) || charge.month < 1 || charge.month > 12) {
        throw new Error('H5 debt experience requires a valid charge month')
      }

      const isPriorPeriod =
        charge.year < currentYear
        || (charge.year === currentYear && charge.month < currentMonth)

      return isPriorPeriod && charge.status === 'overdue'
    })
    .map((charge) => charge.id)

  return {
    asOfDate: input.asOfDate,
    blockedForPriorDebt: blockingChargeIds.length > 0,
    blockingChargeIds,
    charges: input.charges.map((charge) => ({ ...charge })),
  }
}


export type EconomicRevisionState = 'historical' | 'current'
export type EconomicPaymentRevisionState = EconomicRevisionState | 'voided'

/**
 * Builds an explanatory H4 projection for one persisted MonthlyCharge.
 *
 * This preserves the source facts as structured history rather than inventing a
 * synthetic ledger or a total event chronology that the underlying contracts
 * do not provide.
 */
export function explainMonthlyChargeEconomics(input: {
  teamId: string
  cutoffDate: string
  monthlyChargeId: string
  terms: AthleteBillingTerms
  charge: MonthlyChargeCandidate
  globalDueDateHistory: GlobalDueDateExceptionRevision[]
  reductionHistory: MonthlyChargeReductionRevision[]
  extensionHistory: MonthlyChargeExtensionRevision[]
  paymentHistory: PaymentRevision[]
}) {
  parseDate(input.cutoffDate)

  if (
    input.terms.id !== input.charge.billingTermsId
    || input.terms.athleteId !== input.charge.athleteId
  ) {
    throw new Error('Billing terms identity does not match the MonthlyCharge context')
  }

  if (input.globalDueDateHistory.some(revision =>
    revision.teamId !== input.teamId
    || revision.year !== input.charge.year
    || revision.month !== input.charge.month
  )) {
    throw new Error('Global due-date history does not match the requested team/month context')
  }

  if (input.reductionHistory.some(revision => !sameChargeRevision(revision, input.charge))) {
    throw new Error('Reduction history does not match the MonthlyCharge context')
  }

  if (input.extensionHistory.some(revision => !sameChargeRevision(revision, input.charge))) {
    throw new Error('Extension history does not match the MonthlyCharge context')
  }

  if (input.paymentHistory.some(revision => revision.monthlyChargeId !== input.monthlyChargeId)) {
    throw new Error('Payment history does not match the MonthlyCharge context')
  }

  const account = deriveMembershipAccountState({
    cutoffDate: input.cutoffDate,
    charges: [{
      id: input.monthlyChargeId,
      charge: input.charge,
      paymentRevisions: input.paymentHistory,
    }],
  })

  const result = account.charges[0]
  if (!result) {
    throw new Error('Unable to derive H4 MonthlyCharge result')
  }

  return {
    condition: {
      billingTermsId: input.terms.id,
      monthlyAmountMinor: input.terms.monthlyAmountMinor,
      currency: input.terms.currency,
      effectiveFrom: input.terms.effectiveFrom,
      effectiveUntil: input.terms.effectiveUntil,
    },
    charge: {
      monthlyChargeId: input.monthlyChargeId,
      year: input.charge.year,
      month: input.charge.month,
      baseAmountMinor: input.charge.baseAmountMinor,
      amountDueMinor: input.charge.amountDueMinor,
      currency: input.charge.currency,
      baseDueDate: input.charge.baseDueDate,
      effectiveDueDate: input.charge.effectiveDueDate,
    },
    globalDueDateHistory: input.globalDueDateHistory.map(revision => ({
      ...revision,
      state: revision.isCurrent ? 'current' as const : 'historical' as const,
    })),
    reductionHistory: input.reductionHistory.map(revision => ({
      ...revision,
      state: revision.isCurrent ? 'current' as const : 'historical' as const,
    })),
    extensionHistory: input.extensionHistory.map(revision => ({
      ...revision,
      state: revision.isCurrent ? 'current' as const : 'historical' as const,
    })),
    paymentHistory: input.paymentHistory.map(revision => ({
      ...revision,
      state: revision.isCurrent && revision.voided
        ? 'voided' as const
        : revision.isCurrent
          ? 'current' as const
          : 'historical' as const,
    })),
    result: {
      status: result.status,
      amountDueMinor: result.amountDueMinor,
      paidMinor: result.paidMinor,
      remainingMinor: result.remainingMinor,
      effectiveDueDate: result.effectiveDueDate,
      currency: result.currency,
    },
  }
}
