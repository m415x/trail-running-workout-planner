type Locale = 'es' | 'en'

type CurrentTerms = {
  monthlyAmountMinor: number
  currency: string
} | null

export function getAthleteBillingTermsFormModel({
  locale,
  currentTerms,
}: {
  locale: Locale
  currentTerms: CurrentTerms
}) {
  const initial = currentTerms === null
  const copy = locale === 'en'
    ? {
        title: 'Economic terms',
        initialSubmit: 'Apply terms',
        replacementSubmit: 'Schedule change',
        initialHelp: 'The initial economic terms may start on any calendar day.',
        replacementHelp: 'A prospective change must start on the first day of a month.',
      }
    : {
        title: 'Condiciones económicas',
        initialSubmit: 'Aplicar condiciones',
        replacementSubmit: 'Programar cambio',
        initialHelp: 'Las condiciones económicas iniciales pueden comenzar cualquier día del calendario.',
        replacementHelp: 'Un cambio prospectivo debe comenzar el primer día de un mes.',
      }

  if (initial) {
    return {
      mode: 'initial' as const,
      title: copy.title,
      submitLabel: copy.initialSubmit,
      effectiveFromHelp: copy.initialHelp,
    }
  }

  return {
    mode: 'replacement' as const,
    title: copy.title,
    submitLabel: copy.replacementSubmit,
    effectiveFromHelp: copy.replacementHelp,
    monthlyAmount: String(currentTerms.monthlyAmountMinor / 100),
    currency: currentTerms.currency,
  }
}
