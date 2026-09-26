import {
  applyGlobalDueDateException as applyGlobalDueDateExceptionRevision,
  applyMonthlyChargeReduction as applyMonthlyChargeReductionRevision,
  applyMonthlyChargeExtension as applyMonthlyChargeExtensionRevision,
  getAthleteBillingSnapshot,
  materializeMonthlyCharges,
  type AthleteBillingTerms,
  projectMonthlyChargeWithExceptions,
  type GlobalDueDateExceptionRevision,
  type MonthlyChargeCandidate,
  type MonthlyChargeReductionRevision,
  type MonthlyChargeExtensionRevision,
  type TeamEconomicPolicy,
} from './billing'

export type BillingPersistencePort = {
  athleteBelongsToTeam: (teamId: string, athleteId: string) => Promise<boolean>
  listBillingTerms: (teamId: string, athleteId: string) => Promise<AthleteBillingTerms[]>
  listMonthlyCharges: (teamId: string, athleteId: string) => Promise<MonthlyChargeCandidate[]>
  listTeamEconomicPolicies: (teamId: string) => Promise<TeamEconomicPolicy[]>
  insertMonthlyCharges: (
    teamId: string,
    athleteId: string,
    charges: MonthlyChargeCandidate[],
  ) => Promise<void>

}

export type PersistedMonthlyChargeReductionRevision = MonthlyChargeReductionRevision & {
  monthlyChargeId: string
}

export type MonthlyChargeReductionPersistencePort = {
  listMonthlyChargeReductionRevisions: (
    monthlyChargeId: string,
  ) => Promise<PersistedMonthlyChargeReductionRevision[]>
  replaceCurrentMonthlyChargeReduction: (
    monthlyChargeId: string,
    revision: PersistedMonthlyChargeReductionRevision,
  ) => Promise<void>
  applyMonthlyChargeReductionAtomically?: (
    teamId: string,
    monthlyChargeId: string,
    revision: PersistedMonthlyChargeReductionRevision,
    charge: MonthlyChargeCandidate,
  ) => Promise<void>
}

export type PersistedMonthlyChargeExtensionRevision = MonthlyChargeExtensionRevision & {
  monthlyChargeId: string
}

export type MonthlyChargeExtensionPersistencePort = {
  listMonthlyChargeExtensionRevisions: (
    monthlyChargeId: string,
  ) => Promise<PersistedMonthlyChargeExtensionRevision[]>
  replaceCurrentMonthlyChargeExtension: (
    monthlyChargeId: string,
    revision: PersistedMonthlyChargeExtensionRevision,
  ) => Promise<void>
  applyMonthlyChargeExtensionAtomically?: (
    teamId: string,
    monthlyChargeId: string,
    revision: PersistedMonthlyChargeExtensionRevision,
    charge: MonthlyChargeCandidate,
  ) => Promise<void>
}

export type GlobalDueDateExceptionPersistencePort = {
  listGlobalDueDateExceptionRevisions: (
    teamId: string,
    year: number,
    month: number,
  ) => Promise<GlobalDueDateExceptionRevision[]>
  replaceCurrentGlobalDueDateException: (
    teamId: string,
    year: number,
    month: number,
    revision: GlobalDueDateExceptionRevision,
  ) => Promise<void>
  listTeamMonthlyCharges: (
    teamId: string,
    year: number,
    month: number,
  ) => Promise<MonthlyChargeCandidate[]>
  getBillingTermsById: (
    billingTermsId: string,
  ) => Promise<AthleteBillingTerms>
  updateMonthlyChargeDueDates: (
    teamId: string,
    charge: MonthlyChargeCandidate,
  ) => Promise<void>
  applyGlobalDueDateExceptionAtomically?: (
    teamId: string,
    year: number,
    month: number,
    revision: GlobalDueDateExceptionRevision,
    charges: MonthlyChargeCandidate[],
  ) => Promise<void>
}

export function createBillingPersistenceAdapter(
  port: BillingPersistencePort | (BillingPersistencePort & GlobalDueDateExceptionPersistencePort) | (BillingPersistencePort & MonthlyChargeReductionPersistencePort) | (BillingPersistencePort & MonthlyChargeExtensionPersistencePort),
) {
  return {
    async applyGlobalDueDateException(input: {
      teamId: string
      year: number
      month: number
      revision: GlobalDueDateExceptionRevision
    }) {
      const validatedRevisions = applyGlobalDueDateExceptionRevision({
        revisions: [],
        id: input.revision.id,
        teamId: input.revision.teamId,
        year: input.revision.year,
        month: input.revision.month,
        dueDate: input.revision.dueDate,
        reason: input.revision.reason,
      })
      const validatedRevision = validatedRevisions[0]

      const h2Port = port as BillingPersistencePort & GlobalDueDateExceptionPersistencePort
      if (
        !h2Port.replaceCurrentGlobalDueDateException
        || !h2Port.listTeamMonthlyCharges
        || !h2Port.getBillingTermsById
        || !h2Port.updateMonthlyChargeDueDates
      ) {
        throw new Error('Billing persistence does not support global due-date exceptions')
      }

      const charges = await h2Port.listTeamMonthlyCharges(
        input.teamId,
        input.year,
        input.month,
      )
      const projectedCharges: MonthlyChargeCandidate[] = []

      for (const charge of charges) {
        const terms = await h2Port.getBillingTermsById(charge.billingTermsId)
        const projected = projectMonthlyChargeWithExceptions({
          charge,
          globalDueDateException: validatedRevision,
          reductionRevisions: [],
          extensionRevisions: [],
          economicActivationDate: terms.effectiveFrom,
        })
        projectedCharges.push({
          ...projected,
          effectiveDueDate: charge.effectiveDueDate > projected.effectiveDueDate
            ? charge.effectiveDueDate
            : projected.effectiveDueDate,
        })
      }

      if (h2Port.applyGlobalDueDateExceptionAtomically) {
        await h2Port.applyGlobalDueDateExceptionAtomically(
          input.teamId,
          input.year,
          input.month,
          validatedRevision,
          projectedCharges,
        )
        return
      }

      await h2Port.replaceCurrentGlobalDueDateException(
        input.teamId,
        input.year,
        input.month,
        validatedRevision,
      )
      for (const charge of projectedCharges) {
        await h2Port.updateMonthlyChargeDueDates(input.teamId, charge)
      }
    },

    async applyMonthlyChargeReduction(input: {
      teamId: string
      monthlyChargeId: string
      revision: MonthlyChargeReductionRevision
    }) {
      const h2Port = port as BillingPersistencePort & MonthlyChargeReductionPersistencePort
      if (!h2Port.applyMonthlyChargeReductionAtomically) {
        throw new Error('Billing persistence does not support atomic monthly charge reductions')
      }

      const charges = await port.listMonthlyCharges(input.teamId, input.revision.athleteId)
      const charge = charges.find((candidate) =>
        candidate.year === input.revision.year
        && candidate.month === input.revision.month
      )
      if (!charge) throw new Error('Monthly charge not found')

      const persistedRevisions = await h2Port.listMonthlyChargeReductionRevisions(
        input.monthlyChargeId,
      )
      const validatedRevisions = applyMonthlyChargeReductionRevision({
        revisions: persistedRevisions,
        charge,
        id: input.revision.id,
        reductionAmountMinor: input.revision.reductionAmountMinor,
        reason: input.revision.reason,
      })
      const validatedRevision = validatedRevisions.find((revision) => revision.isCurrent)
      if (!validatedRevision) throw new Error('Current monthly charge reduction revision not found')
      const persistedCurrent = persistedRevisions.find((revision) => revision.isCurrent)
      if (
        persistedCurrent
        && validatedRevision.id === persistedCurrent.id
        && validatedRevision.reductionAmountMinor === persistedCurrent.reductionAmountMinor
        && validatedRevision.reason === persistedCurrent.reason
      ) {
        return
      }
      const projected = projectMonthlyChargeWithExceptions({
        charge,
        globalDueDateException: null,
        reductionRevisions: validatedRevisions,
        extensionRevisions: [],
        economicActivationDate: charge.baseDueDate,
      })

      await h2Port.applyMonthlyChargeReductionAtomically(
        input.teamId,
        input.monthlyChargeId,
        {
          ...validatedRevision,
          monthlyChargeId: input.monthlyChargeId,
        },
        projected,
      )
    },

    async applyMonthlyChargeExtension(input: {
      teamId: string
      monthlyChargeId: string
      revision: MonthlyChargeExtensionRevision
    }) {
      const h2Port = port as BillingPersistencePort & MonthlyChargeExtensionPersistencePort
      if (!h2Port.applyMonthlyChargeExtensionAtomically) {
        throw new Error('Billing persistence does not support atomic monthly charge extensions')
      }

      const charges = await port.listMonthlyCharges(input.teamId, input.revision.athleteId)
      const charge = charges.find((candidate) => candidate.year === input.revision.year && candidate.month === input.revision.month)
      if (!charge) throw new Error('Monthly charge not found')

      const persistedRevisions = await h2Port.listMonthlyChargeExtensionRevisions(input.monthlyChargeId)
      const validatedRevisions = applyMonthlyChargeExtensionRevision({
        revisions: persistedRevisions,
        charge,
        id: input.revision.id,
        extendedDueDate: input.revision.extendedDueDate,
        reason: input.revision.reason,
      })
      const validatedRevision = validatedRevisions.find((revision) => revision.isCurrent)
      if (!validatedRevision) throw new Error('Current monthly charge extension revision not found')
      const persistedCurrent = persistedRevisions.find((revision) => revision.isCurrent)
      if (persistedCurrent && validatedRevision.id === persistedCurrent.id) return

      const projected = projectMonthlyChargeWithExceptions({
        charge,
        globalDueDateException: null,
        reductionRevisions: [],
        extensionRevisions: validatedRevisions,
        economicActivationDate: charge.baseDueDate,
      })

      await h2Port.applyMonthlyChargeExtensionAtomically(input.teamId, input.monthlyChargeId, {
        ...validatedRevision,
        monthlyChargeId: input.monthlyChargeId,
      }, projected)
    },

    async getAthleteBillingSnapshot(input: {
      teamId: string
      athleteId: string
    }) {
      return getAthleteBillingSnapshot({
        ...input,
        repository: {
          athleteBelongsToTeam: port.athleteBelongsToTeam,
          getBillingTerms: (athleteId) =>
            port.listBillingTerms(input.teamId, athleteId),
          getMonthlyCharges: (athleteId) =>
            port.listMonthlyCharges(input.teamId, athleteId),
        },
      })
    },

    async materializeMonthlyCharges(input: {
      teamId: string
      athleteId: string
      through: { year: number; month: number }
    }) {
      const belongsToTeam = await port.athleteBelongsToTeam(
        input.teamId,
        input.athleteId,
      )

      if (!belongsToTeam) {
        throw new Error('Athlete does not belong to the requested team')
      }

      return materializeMonthlyCharges({
        athleteId: input.athleteId,
        through: input.through,
        repository: {
          getBillingTerms: (athleteId) =>
            port.listBillingTerms(input.teamId, athleteId),
          getTeamEconomicPolicies: () =>
            port.listTeamEconomicPolicies(input.teamId),
          getMonthlyCharges: (athleteId) =>
            port.listMonthlyCharges(input.teamId, athleteId),
          insertMonthlyCharges: async (charges) => {
            const h2Port = port as BillingPersistencePort & Partial<GlobalDueDateExceptionPersistencePort>
            if (!h2Port.listGlobalDueDateExceptionRevisions) {
              return port.insertMonthlyCharges(input.teamId, input.athleteId, charges)
            }

            const terms = await port.listBillingTerms(input.teamId, input.athleteId)
            const projectedCharges = await Promise.all(charges.map(async (charge) => {
              const revisions = await h2Port.listGlobalDueDateExceptionRevisions!(
                input.teamId,
                charge.year,
                charge.month,
              )
              const current = revisions.find((revision) => revision.isCurrent)
              if (!current) return charge

              const chargeTerms = terms.find((term) => term.id === charge.billingTermsId)
              if (!chargeTerms) throw new Error('Billing terms not found for monthly charge')

              return projectMonthlyChargeWithExceptions({
                charge,
                globalDueDateException: current,
                reductionRevisions: [],
                extensionRevisions: [],
                economicActivationDate: chargeTerms.effectiveFrom,
              })
            }))

            return port.insertMonthlyCharges(
              input.teamId,
              input.athleteId,
              projectedCharges,
            )
          },
        },
      })
    },
  }
}
