import type {
  GlobalDueDateExceptionRevision,
  MonthlyChargeReductionRevision,
  MonthlyChargeExtensionRevision,
} from './billing'
import {
  createBillingPersistenceAdapter,
  type BillingPersistencePort,
  type GlobalDueDateExceptionPersistencePort,
  type MonthlyChargeReductionPersistencePort,
  type MonthlyChargeExtensionPersistencePort,
} from './billing-persistence'
import {
  createSynchronousBillingCoachService,
  type SynchronousBillingCoachRepository,
} from './billing-coach-service'
import {
  createSynchronousAthleteBillingTermsService,
  type SynchronousAthleteBillingTermsRepository,
} from './athlete-billing-terms-service'

type ConfigureTeamEconomicPolicyInput = {
  teamId: string
  effectiveFrom: string
  defaultMonthlyAmountMinor: number
  currency: string
  ordinaryDueDay: number
}

export type BillingCoachActionResult =
  | { success: true }
  | { success: false; error: string }

export type BillingCoachActionDependencies = {
  createId: () => string
  transaction: <T>(
    operation: (
      repository: SynchronousBillingCoachRepository
        | SynchronousAthleteBillingTermsRepository
        | (BillingPersistencePort & GlobalDueDateExceptionPersistencePort)
        | (BillingPersistencePort & MonthlyChargeReductionPersistencePort)
        | (BillingPersistencePort & MonthlyChargeExtensionPersistencePort),
    ) => T,
  ) => T
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
    dependencies.transaction((repository) => {
      const coachRepository = repository as SynchronousBillingCoachRepository
      const service = createSynchronousBillingCoachService(coachRepository)

      service.configureTeamEconomicPolicy({
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
    dependencies.transaction((repository) => {
      const termsRepository = repository as SynchronousAthleteBillingTermsRepository
      const service = createSynchronousAthleteBillingTermsService(termsRepository)
      service.applyInitialTerms({
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
    dependencies.transaction((repository) => {
      const termsRepository = repository as SynchronousAthleteBillingTermsRepository
      const service = createSynchronousAthleteBillingTermsService(termsRepository)
      service.changeTerms({
        ...input,
        termsId: dependencies.createId(),
      })
    })

    return { success: true }
  } catch {
    return { success: false, error: 'Could not change athlete billing terms' }
  }
}


export async function applyGlobalDueDateExceptionAction(
  input: {
    teamId: string
    year: number
    month: number
    dueDate: string
    reason: string
  },
  dependencies: BillingCoachActionDependencies,
): Promise<BillingCoachActionResult> {
  if (
    !input.teamId
    || !Number.isInteger(input.year)
    || input.year < 1
    || !Number.isInteger(input.month)
    || input.month < 1
    || input.month > 12
    || !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)
    || !input.reason.trim()
  ) {
    return { success: false, error: 'Invalid global due-date exception input' }
  }

  try {
    const operation = dependencies.transaction((repository) => {
      const revision: GlobalDueDateExceptionRevision = {
        id: dependencies.createId(),
        teamId: input.teamId,
        year: input.year,
        month: input.month,
        dueDate: input.dueDate,
        reason: input.reason.trim(),
        isCurrent: true,
      }
      const adapter = createBillingPersistenceAdapter(
        repository as BillingPersistencePort & GlobalDueDateExceptionPersistencePort,
      )
      return adapter.applyGlobalDueDateException({
        teamId: input.teamId,
        year: input.year,
        month: input.month,
        revision,
      })
    })
    await operation

    return { success: true }
  } catch {
    return { success: false, error: 'Could not apply global due-date exception' }
  }
}


export async function applyMonthlyChargeReductionAction(
  input: {
    teamId: string
    monthlyChargeId: string
    athleteId: string
    year: number
    month: number
    reductionAmountMinor: number
    reason: string
  },
  dependencies: BillingCoachActionDependencies,
): Promise<BillingCoachActionResult> {
  if (
    !input.teamId
    || !input.monthlyChargeId
    || !input.athleteId
    || !Number.isInteger(input.year)
    || input.year < 1
    || !Number.isInteger(input.month)
    || input.month < 1
    || input.month > 12
    || !Number.isSafeInteger(input.reductionAmountMinor)
    || input.reductionAmountMinor <= 0
    || !input.reason.trim()
  ) {
    return { success: false, error: 'Invalid monthly charge reduction input' }
  }

  try {
    const operation = dependencies.transaction((repository) => {
      const revision: MonthlyChargeReductionRevision = {
        id: dependencies.createId(),
        athleteId: input.athleteId,
        year: input.year,
        month: input.month,
        reductionAmountMinor: input.reductionAmountMinor,
        reason: input.reason.trim(),
        isCurrent: true,
      }
      const adapter = createBillingPersistenceAdapter(
        repository as BillingPersistencePort & MonthlyChargeReductionPersistencePort,
      )
      return adapter.applyMonthlyChargeReduction({
        teamId: input.teamId,
        monthlyChargeId: input.monthlyChargeId,
        revision,
      })
    })
    await operation

    return { success: true }
  } catch {
    return { success: false, error: 'Could not apply monthly charge reduction' }
  }
}

export async function applyMonthlyChargeExtensionAction(
  input: {
    teamId: string
    monthlyChargeId: string
    athleteId: string
    year: number
    month: number
    extendedDueDate: string
    reason: string
  },
  dependencies: BillingCoachActionDependencies,
): Promise<BillingCoachActionResult> {
  if (
    !input.teamId
    || !input.monthlyChargeId
    || !input.athleteId
    || !Number.isInteger(input.year)
    || input.year < 1
    || !Number.isInteger(input.month)
    || input.month < 1
    || input.month > 12
    || !/^\d{4}-\d{2}-\d{2}$/.test(input.extendedDueDate)
    || !input.reason.trim()
  ) {
    return { success: false, error: 'Invalid monthly charge extension input' }
  }

  try {
    const operation = dependencies.transaction((repository) => {
      const revision: MonthlyChargeExtensionRevision = {
        id: dependencies.createId(),
        athleteId: input.athleteId,
        year: input.year,
        month: input.month,
        extendedDueDate: input.extendedDueDate,
        reason: input.reason.trim(),
        isCurrent: true,
      }
      const adapter = createBillingPersistenceAdapter(
        repository as BillingPersistencePort & MonthlyChargeExtensionPersistencePort,
      )
      return adapter.applyMonthlyChargeExtension({
        teamId: input.teamId,
        monthlyChargeId: input.monthlyChargeId,
        revision,
      })
    })
    await operation

    return { success: true }
  } catch {
    return { success: false, error: 'Could not apply monthly charge extension' }
  }
}
