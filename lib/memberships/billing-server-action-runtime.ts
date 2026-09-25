import { createSynchronousBillingCoachService } from './billing-coach-service'
import { createSynchronousDrizzleBillingRepository } from './billing-drizzle-write-repository'
import { createSqliteBillingTransaction } from './billing-sqlite-transaction'

type RuntimeDatabase =
  Parameters<typeof createSynchronousDrizzleBillingRepository>[0]
  & Parameters<typeof createSqliteBillingTransaction>[0]

type ConfigureTeamEconomicPolicyInput = {
  teamId: string
  effectiveFrom: string
  defaultMonthlyAmountMinor: number
  currency: string
  ordinaryDueDay: number
}

type BillingActionResult =
  | { success: true }
  | { success: false; error: string }

function validPolicyInput(input: ConfigureTeamEconomicPolicyInput) {
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

export function createMembershipServerActionRuntime({
  db,
  createId,
}: {
  db: RuntimeDatabase
  createId: () => string
}) {
  const transaction = createSqliteBillingTransaction(db)

  return {
    async configureTeamEconomicPolicy(
      input: ConfigureTeamEconomicPolicyInput,
    ): Promise<BillingActionResult> {
      if (!validPolicyInput(input)) {
        return { success: false, error: 'Invalid team economic policy input' }
      }

      try {
        transaction(() => {
          const repository = createSynchronousDrizzleBillingRepository(db)
          const service = createSynchronousBillingCoachService(repository)

          service.configureTeamEconomicPolicy({
            ...input,
            policyId: createId(),
          })
        })

        return { success: true }
      } catch {
        return {
          success: false,
          error: 'Could not configure team economic policy',
        }
      }
    },
  }
}
