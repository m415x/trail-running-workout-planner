import type {
  AthleteBillingTerms,
  MonthlyChargeCandidate,
} from './billing'

type Locale = 'es' | 'en'

function formatAmount(amountMinor: number, locale: Locale) {
  const amount = new Intl.NumberFormat(locale === 'es' ? 'es-AR' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(amountMinor / 100)

  return String.fromCharCode(36) + amount
}

function formatPeriod(year: number, month: number) {
  return `${String(month).padStart(2, '0')}/${year}`
}

export function buildAthleteMembershipViewModel({
  locale,
  terms,
  charges,
  onDate,
}: {
  locale: Locale
  terms: AthleteBillingTerms[]
  charges: MonthlyChargeCandidate[]
  onDate: string
}) {
  const copy = locale === 'en'
    ? {
        title: 'Membership',
        emptyTerms: 'No economic terms have been configured for this athlete yet.',
        emptyCharges: 'No monthly charges have been materialized yet.',
      }
    : {
        title: 'Membresía',
        emptyTerms: 'Todavía no se configuraron condiciones económicas para este atleta.',
        emptyCharges: 'Todavía no se materializaron cuotas mensuales.',
      }

  const currentTerms = terms.find((item) =>
    item.effectiveFrom <= onDate
    && (item.effectiveUntil === null || onDate < item.effectiveUntil),
  ) ?? null
  const scheduledTerms = terms
    .filter((item) => item.effectiveFrom > onDate)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
  const pastTerms = terms
    .filter((item) => item.effectiveUntil !== null && item.effectiveUntil <= onDate)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))

  const mapTerms = (item: AthleteBillingTerms) => ({
    monthlyAmount: formatAmount(item.monthlyAmountMinor, locale),
    monthlyAmountMinor: item.monthlyAmountMinor,
    currency: item.currency,
    effectiveFrom: item.effectiveFrom,
    effectiveUntil: item.effectiveUntil,
  })

  return {
    title: copy.title,
    currentTerms: currentTerms ? mapTerms(currentTerms) : null,
    scheduledTerms: scheduledTerms.map(mapTerms),
    pastTerms: pastTerms.map(mapTerms),
    emptyTerms: copy.emptyTerms,
    charges: charges
      .slice()
      .sort((a, b) => b.year - a.year || b.month - a.month)
      .map((charge) => ({
        period: formatPeriod(charge.year, charge.month),
        amountDue: formatAmount(charge.amountDueMinor, locale),
        currency: charge.currency,
        effectiveDueDate: charge.effectiveDueDate,
      })),
    emptyCharges: copy.emptyCharges,
  }
}
