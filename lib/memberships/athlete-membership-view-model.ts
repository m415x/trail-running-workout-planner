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
}: {
  locale: Locale
  terms: AthleteBillingTerms[]
  charges: MonthlyChargeCandidate[]
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

  const currentTerms = terms.find((item) => item.effectiveUntil === null) ?? null

  return {
    title: copy.title,
    currentTerms: currentTerms
      ? {
          monthlyAmount: formatAmount(currentTerms.monthlyAmountMinor, locale),
          monthlyAmountMinor: currentTerms.monthlyAmountMinor,
          currency: currentTerms.currency,
          effectiveFrom: currentTerms.effectiveFrom,
          effectiveUntil: currentTerms.effectiveUntil,
        }
      : null,
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
