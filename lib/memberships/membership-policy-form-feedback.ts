export type MembershipLocale = 'es' | 'en'

export function getTeamEconomicPolicyFormFeedback(locale: MembershipLocale) {
  if (locale === 'en') {
    return {
      pendingLabel: 'Saving…',
      genericError: 'The economic policy could not be saved.',
    }
  }

  return {
    pendingLabel: 'Guardando…',
    genericError: 'No se pudo guardar la política económica.',
  }
}
