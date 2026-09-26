import { createSynchronousBillingCoachService } from './billing-coach-service'
import {
  applyGlobalDueDateExceptionAction,
  applyMonthlyChargeReductionAction,
  applyMonthlyChargeExtensionAction,
  type BillingCoachActionDependencies,
} from './billing-coach-actions'
import { createDrizzleBillingDatabase } from './billing-drizzle-database'
import { createSqliteBillingPersistencePort } from './billing-sqlite-persistence'
import { createSynchronousAthleteBillingTermsService } from './athlete-billing-terms-service'
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
  reportError = console.error,
}: {
  db: RuntimeDatabase
  createId: () => string
  reportError?: (error: unknown) => void
}) {
  const transaction = createSqliteBillingTransaction(db)

  const h2Dependencies: BillingCoachActionDependencies = {
    createId,
    transaction: (operation) => transaction(() =>
      operation(createSqliteBillingPersistencePort(createDrizzleBillingDatabase(db)))),
  }

  function athleteTermsService() {
    const repository = createSynchronousDrizzleBillingRepository(db)
    return createSynchronousAthleteBillingTermsService(repository)
  }

  return {

    async applyGlobalDueDateException(input: {
      teamId: string
      year: number
      month: number
      dueDate: string
      reason: string
    }): Promise<BillingActionResult> {
      return applyGlobalDueDateExceptionAction(input, h2Dependencies)
    },

    async applyMonthlyChargeReduction(input: {
      teamId: string
      monthlyChargeId: string
      athleteId: string
      year: number
      month: number
      reductionAmountMinor: number
      reason: string
    }): Promise<BillingActionResult> {
      return applyMonthlyChargeReductionAction(input, h2Dependencies)
    },

    async applyMonthlyChargeExtension(input: {
      teamId: string
      monthlyChargeId: string
      athleteId: string
      year: number
      month: number
      extendedDueDate: string | null
      reason: string
    }): Promise<BillingActionResult> {
      return applyMonthlyChargeExtensionAction(input, h2Dependencies)
    },

    async applyInitialAthleteBillingTerms(input: {
      teamId: string
      athleteId: string
      effectiveFrom: string
    }): Promise<BillingActionResult> {
      if (!input.teamId || !input.athleteId || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) {
        return { success: false, error: 'Invalid athlete billing terms input' }
      }

      try {
        transaction(() => {
          athleteTermsService().applyInitialTerms({
            ...input,
            termsId: createId(),
          })
        })
        return { success: true }
      } catch (error) {
        reportError(error)
        return { success: false, error: 'Could not apply athlete billing terms' }
      }
    },

    async changeAthleteBillingTerms(input: {
      teamId: string
      athleteId: string
      effectiveFrom: string
      monthlyAmountMinor: number
      currency: string
    }): Promise<BillingActionResult> {
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
        transaction(() => {
          athleteTermsService().changeTerms({
            ...input,
            termsId: createId(),
          })
        })
        return { success: true }
      } catch (error) {
        reportError(error)
        return { success: false, error: 'Could not change athlete billing terms' }
      }
    },

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
      } catch (error) {
        reportError(error)
        return {
          success: false,
          error: 'Could not configure team economic policy',
        }
      }
    },
  }
}
