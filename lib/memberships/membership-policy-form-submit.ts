type TeamEconomicPolicySubmitInput = {
  defaultMonthlyAmountMinor: number
  currency: string
  ordinaryDueDay: number
  effectiveFrom: string
}

type SubmitResult =
  | { success: true }
  | { success: false; error: string }

function isFirstDayOfMonth(value: string) {
  return /^\d{4}-\d{2}-01$/.test(value)
}

export async function submitTeamEconomicPolicyForm({
  input,
  submit,
}: {
  input: {
    monthlyAmount: string
    currency: string
    ordinaryDueDay: string
    effectiveFrom: string
  }
  submit: (input: TeamEconomicPolicySubmitInput) => Promise<SubmitResult>
}): Promise<SubmitResult> {
  const monthlyAmount = Number(input.monthlyAmount)
  const ordinaryDueDay = Number(input.ordinaryDueDay)

  const valid = (
    /^\d+$/.test(input.monthlyAmount)
    && Number.isSafeInteger(monthlyAmount)
    && monthlyAmount > 0
    && input.currency === 'ARS'
    && /^\d+$/.test(input.ordinaryDueDay)
    && Number.isInteger(ordinaryDueDay)
    && ordinaryDueDay >= 1
    && ordinaryDueDay <= 31
    && isFirstDayOfMonth(input.effectiveFrom)
  )

  if (!valid) {
    return {
      success: false,
      error: 'Invalid team economic policy form input',
    }
  }

  const defaultMonthlyAmountMinor = monthlyAmount * 100

  if (!Number.isSafeInteger(defaultMonthlyAmountMinor)) {
    return {
      success: false,
      error: 'Invalid team economic policy form input',
    }
  }

  return submit({
    defaultMonthlyAmountMinor,
    currency: input.currency,
    ordinaryDueDay,
    effectiveFrom: input.effectiveFrom,
  })
}
