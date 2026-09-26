import type { TeamEconomicPolicy } from './billing'

type Locale = 'es' | 'en'

const copy = {
  es: {
    initialTitle: 'Configurar política económica',
    initialSubmitLabel: 'Guardar política',
    replacementTitle: 'Programar cambio de política económica',
    replacementSubmitLabel: 'Programar cambio',
    monthlyAmountLabel: 'Cuota mensual predeterminada',
    currencyLabel: 'Moneda',
    dueDayLabel: 'Día de vencimiento ordinario',
    effectiveFromLabel: 'Vigente desde',
    effectiveFromHelp: 'La política debe comenzar el primer día de un mes.',
  },
  en: {
    initialTitle: 'Configure economic policy',
    initialSubmitLabel: 'Save policy',
    replacementTitle: 'Schedule economic policy change',
    replacementSubmitLabel: 'Schedule change',
    monthlyAmountLabel: 'Default monthly fee',
    currencyLabel: 'Currency',
    dueDayLabel: 'Ordinary due day',
    effectiveFromLabel: 'Effective from',
    effectiveFromHelp: 'The new policy must start on the first day of a month.',
  },
} as const

export function getTeamEconomicPolicyFormModel({
  locale,
  policy,
}: {
  locale: Locale
  policy: TeamEconomicPolicy | null
}) {
  const labels = copy[locale]
  const replacement = policy !== null

  return {
    mode: replacement ? 'replacement' as const : 'initial' as const,
    title: replacement ? labels.replacementTitle : labels.initialTitle,
    submitLabel: replacement ? labels.replacementSubmitLabel : labels.initialSubmitLabel,
    monthlyAmountLabel: labels.monthlyAmountLabel,
    currencyLabel: labels.currencyLabel,
    dueDayLabel: labels.dueDayLabel,
    effectiveFromLabel: labels.effectiveFromLabel,
    effectiveFromHelp: labels.effectiveFromHelp,
    monthlyAmountMinor: policy?.defaultMonthlyAmountMinor ?? null,
    currency: policy?.currency ?? 'ARS',
    ordinaryDueDay: policy?.ordinaryDueDay ?? 5,
  }
}
