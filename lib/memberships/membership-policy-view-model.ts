import { resolveApplicationRegionalContext } from '@/lib/regionalization/application-regional-context'
import type { TeamEconomicPolicy } from './billing'

type Locale = 'es' | 'en'

const copy = {
  es: {
    title: 'Membresía',
    policyTitle: 'Política económica del equipo',
    monthlyAmountLabel: 'Cuota mensual predeterminada',
    currencyLabel: 'Moneda',
    dueDayLabel: 'Día de vencimiento ordinario',
    effectiveFromLabel: 'Vigente desde',
    emptyState: 'Todavía no hay una política económica configurada.',
  },
  en: {
    title: 'Membership',
    policyTitle: 'Team economic policy',
    monthlyAmountLabel: 'Default monthly fee',
    currencyLabel: 'Currency',
    dueDayLabel: 'Ordinary due day',
    effectiveFromLabel: 'Effective from',
    emptyState: 'No economic policy has been configured yet.',
  },
} as const

function formatAmount(locale: Locale, amountMinor: number, currency: string) {
  const { presentationLocale } = resolveApplicationRegionalContext({ language: locale })

  return new Intl.NumberFormat(presentationLocale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100)
}

export function getMembershipPolicyViewModel({
  locale,
  policy,
}: {
  locale: Locale
  policy: TeamEconomicPolicy | null
}) {
  const labels = copy[locale]

  return {
    ...labels,
    monthlyAmount: policy ? formatAmount(locale, policy.defaultMonthlyAmountMinor, policy.currency) : null,
    currency: policy?.currency ?? null,
    dueDay: policy ? String(policy.ordinaryDueDay) : null,
    effectiveFrom: policy?.effectiveFrom ?? null,
    effectiveUntil: policy?.effectiveUntil ?? null,
  }
}
