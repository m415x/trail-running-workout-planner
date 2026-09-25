type Locale = 'es' | 'en'

type ActionResult = {
  success: boolean
  error?: string
}

type InitialInput = {
  athleteId: string
  effectiveFrom: string
  locale: Locale
}

type ReplacementInput = InitialInput & {
  monthlyAmountMinor: number
  currency: string
}

type CommonInput = {
  athleteId: string
  locale: Locale
  effectiveFrom: string
  applyInitial: (input: InitialInput) => Promise<ActionResult>
  changeTerms: (input: ReplacementInput) => Promise<ActionResult>
}

type FormInput = CommonInput & (
  | { mode: 'initial' }
  | { mode: 'replacement'; monthlyAmount: string; currency: string }
)

const INVALID_INPUT = 'Invalid athlete billing terms form input'

function isValidCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [yearText, monthText, dayText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const date = new Date(Date.UTC(year, month - 1, day))

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

export async function submitAthleteBillingTermsForm(input: FormInput) {
  if (!isValidCalendarDate(input.effectiveFrom)) {
    return { success: false as const, error: INVALID_INPUT }
  }

  if (input.mode === 'initial') {
    return input.applyInitial({
      athleteId: input.athleteId,
      effectiveFrom: input.effectiveFrom,
      locale: input.locale,
    })
  }

  if (!/^\d{4}-\d{2}-01$/.test(input.effectiveFrom)) {
    return { success: false as const, error: INVALID_INPUT }
  }

  if (!/^\d+$/.test(input.monthlyAmount)) {
    return { success: false as const, error: INVALID_INPUT }
  }

  const monthlyAmountPesos = Number(input.monthlyAmount)
  if (!Number.isSafeInteger(monthlyAmountPesos) || monthlyAmountPesos <= 0) {
    return { success: false as const, error: INVALID_INPUT }
  }

  const monthlyAmountMinor = monthlyAmountPesos * 100
  if (!Number.isSafeInteger(monthlyAmountMinor) || input.currency !== 'ARS') {
    return { success: false as const, error: INVALID_INPUT }
  }

  return input.changeTerms({
    athleteId: input.athleteId,
    effectiveFrom: input.effectiveFrom,
    monthlyAmountMinor,
    currency: input.currency,
    locale: input.locale,
  })
}
