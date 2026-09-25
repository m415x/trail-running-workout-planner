import {
  createBillingCoachService,
  type BillingCoachRepository,
} from './billing-coach-service'
import {
  createAthleteBillingTermsService,
  type AthleteBillingTermsRepository,
} from './athlete-billing-terms-service'

type ConfigureTeamEconomicPolicyInput = {
  teamId: string
  effectiveFrom: string
  defaultMonthlyAmountMinor: number
  currency: string
  ordinaryDueDay: number
}

type BillingCoachActionResult =
  | { success: true }
  | { success: false; error?: string }

export type BillingCoachActionDependencies = {
  createId: () => string
  transaction: <T, TRepository extends BillingCoachRepository | AthleteBillingTermsRepository>(
    operation: (repository: TRepository) => Promise<T>,
  ) => Promise<T>
}

function isValidInput(input: ConfigureTeamEconomicPolicyInput) {
  return (
    /^\d{4}-\d{2}-01$/.test(input.effectiveFrom)
    && Number.isSafeInteger(input.defaultMonthlyAmountMinor)
    && input.defaultMonthlyAmountMinor > 0
    && input.currency.trim().length > 0
    && Number.isInteger(input.ordinaryDueDay)
    && input.ordinaryDueDay >= 1
    && input.ordinaryDueDay <= 31
  )
}

export async function configureTeamEconomicPolicyAction(
  input: ConfigureTeamEconomicPolicyInput,
  dependencies: BillingCoachActionDependencies,
): Promise<BillingCoachActionResult> {
  if (!isValidInput(input)) {
    return { success: false, error: 'Invalid team economic policy input' }
  }

  try {
    await dependencies.transaction(async (repository) => {
      const service = createBillingCoachService(repository)

      await service.configureTeamEconomicPolicy({
        ...input,
        policyId: dependencies.createId(),
      })
    })

    return { success: true }
  } catch {
    return {
      success: false,
      error: 'Could not configure team economic policy',
    }
  }
}


export async function applyInitialAthleteBillingTermsAction(
  input: {
    teamId: string
    athleteId: string
    effectiveFrom: string
  },
  dependencies: BillingCoachActionDependencies,
): Promise<BillingCoachActionResult> {
  if (!input.teamId || !input.athleteId || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) {
    return { success: false, error: 'Invalid athlete billing terms input' }
  }

  try {
    await dependencies.transaction(async (repository) => {
      const service = createAthleteBillingTermsService(repository)
      await service.applyInitialTerms({
        ...input,
        termsId: dependencies.createId(),
      })
    })

    return { success: true }
  } catch {
    return { success: false, error: 'Could not apply athlete billing terms' }
  }
}

export async function changeAthleteBillingTermsAction(
  input: {
    teamId: string
    athleteId: string
    effectiveFrom: string
    monthlyAmountMinor: number
    currency: string
  },
  dependencies: BillingCoachActionDependencies,
): Promise<BillingCoachActionResult> {
  if (
    !input.teamId
    || !input.athleteId
    || !/^\d{4}-\d{2}-01$/.test(input.effectiveFrom)
    || !Number.isSafeInteger(input.monthlyAmountMinor)
    || input.monthlyAmountMinor <= 0
    || !input.currency.trim()
  ) {
    return { success: false, error: 'Invalid athlete billing terms input' }
  }

  try {
    await dependencies.transaction(async (repository) => {
      const service = createAthleteBillingTermsService(repository)
      await service.changeTerms({
        ...input,
        termsId: dependencies.createId(),
      })
    })

    return { success: true }
  } catch {
    return { success: false, error: 'Could not change athlete billing terms' }
  }
}
