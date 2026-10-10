import { createSynchronousBillingCoachService } from './billing-coach-service'
import { materializeMonthlyChargesThrough, projectMonthlyChargeWithExceptions } from './billing'
import { globalMonthlyDueDateExceptions, monthlyCharges } from '@/db/schema'
import {
  applyGlobalDueDateExceptionAction,
  applyMonthlyChargeReductionAction,
  applyMonthlyChargeExtensionAction,
  materializeTeamMonthlyChargesAction,
  type BillingCoachActionDependencies,
} from './billing-coach-actions'
import { createDrizzleBillingDatabase } from './billing-drizzle-database'
import { createBillingPersistenceAdapter } from './billing-persistence'
import { createSqliteBillingPersistencePort } from './billing-sqlite-persistence'
import { createSynchronousAthleteBillingTermsService } from './athlete-billing-terms-service'
import { createSynchronousDrizzleBillingRepository } from './billing-drizzle-write-repository'
import { createSqliteBillingTransaction } from './billing-sqlite-transaction'

type RuntimeDatabase =
  Parameters<typeof createSynchronousDrizzleBillingRepository>[0]
  & Parameters<typeof createSqliteBillingTransaction>[0]

type CurrentGlobalExceptionRow = {
  id: string
  createdByUserId: string | null
  teamId: string
  year: number
  month: number
  dueDate: string
  reason: string
  isCurrent: boolean
}

type JoinMonthBillingClient = RuntimeDatabase & {
  select: () => {
    from: (table: unknown) => {
      where: () => {
        all: () => CurrentGlobalExceptionRow[]
      }
    }
  }
  insert: (table: unknown) => {
    values: (values: Record<string, unknown>) => {
      run?: () => unknown
    }
  }
}

type ConfigureTeamEconomicPolicyInput = {
  authorship?: import('@/lib/authorization/h7a-trusted-authorship').TrustedH7aAuthorship
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
    transaction: (operation) =>
      operation(createSqliteBillingPersistencePort(createDrizzleBillingDatabase(db))),
  }

  function bulkMaterializationDependencies(): BillingCoachActionDependencies {
    const billingDatabase = createDrizzleBillingDatabase(db)
    const billingPersistence = createSqliteBillingPersistencePort(billingDatabase)

    return {
      ...h2Dependencies,
      listTeamAthleteIds: async (teamId) => {
        const candidates = await billingDatabase.listTeamAthleteIds?.(teamId)
        return candidates ?? []
      },
      materializeMonthlyCharges: (input) =>
        createBillingPersistenceAdapter(billingPersistence).materializeMonthlyCharges(input),
    }
  }

  function athleteTermsService() {
    const repository = createSynchronousDrizzleBillingRepository(db)
    return createSynchronousAthleteBillingTermsService(repository)
  }

  return {

    async materializeTeamMonthlyCharges(input: {
      teamId: string
      year: number
      month: number
    }) {
      return materializeTeamMonthlyChargesAction(input, bulkMaterializationDependencies())
    },

    initializeNewAthleteBillingInTransaction(input: {
      teamId: string
      athleteId: string
      effectiveFrom: string
    }) {
      if (!input.teamId || !input.athleteId || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) {
        throw new Error('Invalid new athlete billing input')
      }

      const [year, month] = input.effectiveFrom.split('-').map(Number)
      if (!year || !month) throw new Error('Invalid new athlete billing input')

      const repository = createSynchronousDrizzleBillingRepository(db)
      const terms = createSynchronousAthleteBillingTermsService(repository).applyInitialTerms({
        ...input,
        termsId: createId(),
      })
      const policies = repository.listTeamEconomicPolicies(input.teamId)
      const charges = materializeMonthlyChargesThrough({
        terms: [terms],
        policies,
        existingCharges: [],
        through: { year, month },
      })

      if (charges.length !== 1) {
        throw new Error('New athlete join-month charge was not materialized')
      }

      const joinMonthDb = db as JoinMonthBillingClient
      const currentGlobalExceptions = joinMonthDb
        .select()
        .from(globalMonthlyDueDateExceptions)
        .where()
        .all()
        .filter((revision) =>
          revision.teamId === input.teamId
          && revision.year === year
          && revision.month === month
          && revision.isCurrent,
        )
      if (currentGlobalExceptions.length > 1) {
        throw new Error('More than one current global due-date exception exists for the join month')
      }

      const charge = projectMonthlyChargeWithExceptions({
        charge: charges[0]!,
        globalDueDateException: currentGlobalExceptions[0] ?? null,
        economicActivationDate: input.effectiveFrom,
        reductionRevisions: [],
        extensionRevisions: [],
      })

      const now = new Date().toISOString()
      joinMonthDb.insert(monthlyCharges).values({
        id: createId(),
        ...charge,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      }).run?.()

      return charge
    },

    async initializeNewAthleteBilling(input: {
      teamId: string
      athleteId: string
      effectiveFrom: string
    }): Promise<BillingActionResult> {
      if (!input.teamId || !input.athleteId || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) {
        return { success: false, error: 'Invalid new athlete billing input' }
      }

      const [year, month] = input.effectiveFrom.split('-').map(Number)
      if (!year || !month) {
        return { success: false, error: 'Invalid new athlete billing input' }
      }

      try {
        transaction(() => {
          athleteTermsService().applyInitialTerms({
            ...input,
            termsId: createId(),
          })
        })

        const result = await createBillingPersistenceAdapter(
          createSqliteBillingPersistencePort(createDrizzleBillingDatabase(db)),
        ).materializeMonthlyCharges({
          teamId: input.teamId,
          athleteId: input.athleteId,
          through: { year, month },
        })

        if (result.length !== 1) {
          throw new Error('New athlete join-month charge was not materialized')
        }

        return { success: true }
      } catch (error) {
        reportError(error)
        return { success: false, error: 'Could not initialize new athlete billing' }
      }
    },

    async applyGlobalDueDateException(input: {
      teamId: string
      year: number
      month: number
      dueDate: string
      reason: string
      authorship?: import('@/lib/authorization/h7a-trusted-authorship').TrustedH7aAuthorship
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
      authorship?: import('@/lib/authorization/h7a-trusted-authorship').TrustedH7aAuthorship
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
      authorship?: import('@/lib/authorization/h7a-trusted-authorship').TrustedH7aAuthorship
    }): Promise<BillingActionResult> {
      return applyMonthlyChargeExtensionAction(input, h2Dependencies)
    },

    async registerManualPayment(input: {
      teamId: string
      athleteId: string
      monthlyChargeId: string
      authorship?: import('@/lib/authorization/h7a-trusted-authorship').TrustedH7aAuthorship
      amountMinor: number
      paymentMethod: 'cash' | 'bank_transfer'
      paidAt: string
    }): Promise<BillingActionResult> {
      try {
        await createBillingPersistenceAdapter(
          createSqliteBillingPersistencePort(createDrizzleBillingDatabase(db)),
        ).registerManualPayment({
          ...input,
          createdByUserId: input.authorship?.effectiveActorUserId ?? null,
          revisionId: createId(),
          paymentId: createId(),
        })
        return { success: true }
      } catch (error) {
        reportError(error)
        return { success: false, error: 'Could not register manual payment' }
      }
    },

    async correctManualPayment(input: {
      teamId: string
      athleteId: string
      monthlyChargeId: string
      authorship?: import('@/lib/authorization/h7a-trusted-authorship').TrustedH7aAuthorship
      paymentId: string
      amountMinor: number
      paymentMethod: 'cash' | 'bank_transfer'
      paidAt: string
    }): Promise<BillingActionResult> {
      try {
        await createBillingPersistenceAdapter(
          createSqliteBillingPersistencePort(createDrizzleBillingDatabase(db)),
        ).correctManualPayment({
          ...input,
          createdByUserId: input.authorship?.effectiveActorUserId ?? null,
          revisionId: createId(),
        })
        return { success: true }
      } catch (error) {
        reportError(error)
        return { success: false, error: 'Could not correct manual payment' }
      }
    },

    async voidManualPayment(input: {
      teamId: string
      athleteId: string
      monthlyChargeId: string
      authorship?: import('@/lib/authorization/h7a-trusted-authorship').TrustedH7aAuthorship
      paymentId: string
    }): Promise<BillingActionResult> {
      try {
        await createBillingPersistenceAdapter(
          createSqliteBillingPersistencePort(createDrizzleBillingDatabase(db)),
        ).voidManualPayment({
          ...input,
          createdByUserId: input.authorship?.effectiveActorUserId ?? null,
          revisionId: createId(),
        })
        return { success: true }
      } catch (error) {
        reportError(error)
        return { success: false, error: 'Could not void manual payment' }
      }
    },

    async applyInitialAthleteBillingTerms(input: {
      teamId: string
      athleteId: string
      effectiveFrom: string
      authorship?: import('@/lib/authorization/h7a-trusted-authorship').TrustedH7aAuthorship
    }): Promise<BillingActionResult> {
      if (!input.teamId || !input.athleteId || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) {
        return { success: false, error: 'Invalid athlete billing terms input' }
      }

      try {
        transaction(() => {
          athleteTermsService().applyInitialTerms({
            ...input,
            createdByUserId: input.authorship?.effectiveActorUserId ?? null,
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
      authorship?: import('@/lib/authorization/h7a-trusted-authorship').TrustedH7aAuthorship
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
            createdByUserId: input.authorship?.effectiveActorUserId ?? null,
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
            ...(input.authorship
              ? { createdByUserId: input.authorship.effectiveActorUserId }
              : { createdByUserId: null }),
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
