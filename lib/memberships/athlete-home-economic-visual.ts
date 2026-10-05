/**
 * Presentation-only projection of the existing H4/H5 economic read model.
 * No dates, browser clocks, payment calculations or access decisions here.
 */
export type AthleteEconomicVisualTone = 'normal' | 'warning' | 'danger' | 'neutral'
export type AthleteEconomicVisualMessage =
  | 'current_settled'
  | 'current_pending'
  | 'current_overdue'
  | 'prior_overdue_debt'
  | 'account_unknown'

export type AthleteEconomicVisualState = {
  tone: AthleteEconomicVisualTone
  message: AthleteEconomicVisualMessage
}

export function projectAthleteEconomicVisualState(input: {
  currentCharge: {
    status: 'settled' | 'pending' | 'overdue'
    remainingMinor: number
  } | null
  blockedForPriorDebt: boolean
  available: boolean
}): AthleteEconomicVisualState {
  if (input.blockedForPriorDebt) {
    return { tone: 'danger', message: 'prior_overdue_debt' }
  }

  if (!input.available || !input.currentCharge) {
    return { tone: 'neutral', message: 'account_unknown' }
  }

  const { status, remainingMinor } = input.currentCharge
  if (!Number.isSafeInteger(remainingMinor) || remainingMinor < 0) {
    return { tone: 'neutral', message: 'account_unknown' }
  }

  if (status === 'settled' && remainingMinor === 0) {
    return { tone: 'normal', message: 'current_settled' }
  }
  if (remainingMinor > 0 && status === 'pending') {
    return { tone: 'warning', message: 'current_pending' }
  }
  if (remainingMinor > 0 && status === 'overdue') {
    return { tone: 'danger', message: 'current_overdue' }
  }

  return { tone: 'neutral', message: 'account_unknown' }
}
