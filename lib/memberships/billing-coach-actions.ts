import {
  createBillingCoachService,
  type BillingCoachRepository,
} from './billing-coach-service'

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
  transaction: <T>(
    operation: (repository: BillingCoachRepository) => Promise<T>,
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
