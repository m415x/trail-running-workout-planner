type BillingActionResult =
  | { success: true }
  | { success: false; error: string }

type MembershipActionRuntime = {
  configureTeamEconomicPolicy: (input: {
    teamId: string
    effectiveFrom: string
    defaultMonthlyAmountMinor: number
    currency: string
    ordinaryDueDay: number
  }) => Promise<BillingActionResult>
  applyInitialAthleteBillingTerms: (input: {
    teamId: string
    athleteId: string
    effectiveFrom: string
  }) => Promise<BillingActionResult>
  changeAthleteBillingTerms: (input: {
    teamId: string
    athleteId: string
    effectiveFrom: string
    monthlyAmountMinor: number
    currency: string
  }) => Promise<BillingActionResult>
  applyGlobalDueDateException: (input: {
    teamId: string
    year: number
    month: number
    dueDate: string
    reason: string
  }) => Promise<BillingActionResult>
  applyMonthlyChargeReduction: (input: {
    teamId: string
    monthlyChargeId: string
    athleteId: string
    year: number
    month: number
    reductionAmountMinor: number
    reason: string
  }) => Promise<BillingActionResult>
  applyMonthlyChargeExtension: (input: {
    teamId: string
    monthlyChargeId: string
    athleteId: string
    year: number
    month: number
    extendedDueDate: string | null
    reason: string
  }) => Promise<BillingActionResult>
}

type Locale = 'es' | 'en'

function localizedPath(locale: Locale, path: string) {
  return locale === 'es' ? path : `/${locale}${path}`
}

export function createMembershipActionHandlers({
  teamId,
  runtime,
  revalidatePath,
}: {
  teamId: string
  runtime: MembershipActionRuntime
  revalidatePath: (path: string) => void
}) {
  return {
    async configureTeamEconomicPolicy(input: {
      effectiveFrom: string
      defaultMonthlyAmountMinor: number
      currency: string
      ordinaryDueDay: number
    }) {
      const result = await runtime.configureTeamEconomicPolicy({
        ...input,
        teamId,
      })

      if (result.success) revalidatePath('/dashboard/membership')
      return result
    },

    async applyInitialAthleteBillingTerms(input: {
      athleteId: string
      effectiveFrom: string
      locale: Locale
    }) {
      const { locale, ...billingInput } = input
      const result = await runtime.applyInitialAthleteBillingTerms({
        ...billingInput,
        teamId,
      })

      if (result.success) {
        revalidatePath(localizedPath(locale, `/dashboard/athletes/${input.athleteId}`))
      }
      return result
    },

    async changeAthleteBillingTerms(input: {
      athleteId: string
      effectiveFrom: string
      monthlyAmountMinor: number
      currency: string
      locale: Locale
    }) {
      const { locale, ...billingInput } = input
      const result = await runtime.changeAthleteBillingTerms({
        ...billingInput,
        teamId,
      })

      if (result.success) {
        revalidatePath(localizedPath(locale, `/dashboard/athletes/${input.athleteId}`))
      }
      return result
    },


    async applyGlobalDueDateException(input: {
      year: number
      month: number
      dueDate: string
      reason: string
      locale: Locale
    }) {
      const { locale, ...billingInput } = input
      const result = await runtime.applyGlobalDueDateException({
        ...billingInput,
        teamId,
      })
      if (result.success) {
        revalidatePath(localizedPath(locale, '/dashboard/membership'))
      }
      return result
    },

    async applyMonthlyChargeReduction(input: {
      monthlyChargeId: string
      athleteId: string
      year: number
      month: number
      reductionAmountMinor: number
      reason: string
      locale: Locale
    }) {
      const { locale, ...billingInput } = input
      const result = await runtime.applyMonthlyChargeReduction({
        ...billingInput,
        teamId,
      })
      if (result.success) {
        revalidatePath(localizedPath(locale, `/dashboard/athletes/${input.athleteId}`))
      }
      return result
    },

    async applyMonthlyChargeExtension(input: {
      monthlyChargeId: string
      athleteId: string
      year: number
      month: number
      extendedDueDate: string | null
      reason: string
      locale: Locale
    }) {
      const { locale, ...billingInput } = input
      const result = await runtime.applyMonthlyChargeExtension({
        ...billingInput,
        teamId,
      })
      if (result.success) {
        revalidatePath(localizedPath(locale, `/dashboard/athletes/${input.athleteId}`))
      }
      return result
    },
  }
}
