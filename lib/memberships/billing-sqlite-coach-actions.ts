import type { TeamEconomicPolicy } from './billing'
import { createSynchronousBillingCoachService } from './billing-coach-service'
import { createSynchronousDrizzleBillingRepository } from './billing-drizzle-write-repository'
import { createSqliteBillingTransaction } from './billing-sqlite-transaction'

type ConfigureTeamEconomicPolicyInput = {
  teamId: string
  effectiveFrom: string
  defaultMonthlyAmountMinor: number
  currency: string
  ordinaryDueDay: number
}

type SynchronousBillingDatabase =
  Parameters<typeof createSynchronousDrizzleBillingRepository>[0]
  & Parameters<typeof createSqliteBillingTransaction>[0]

export function configureTeamEconomicPolicySynchronously({
  db,
  createId,
  input,
}: {
  db: SynchronousBillingDatabase
  createId: () => string
  input: ConfigureTeamEconomicPolicyInput
}): TeamEconomicPolicy {
  const transaction = createSqliteBillingTransaction(db)

  return transaction(() => {
    const repository = createSynchronousDrizzleBillingRepository(db)
    const service = createSynchronousBillingCoachService(repository)

    return service.configureTeamEconomicPolicy({
      ...input,
      policyId: createId(),
    })
  })
}
