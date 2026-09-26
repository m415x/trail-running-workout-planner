import assert from 'node:assert/strict'
import test from 'node:test'

import {
  configureTeamEconomicPolicyAction,
  applyInitialAthleteBillingTermsAction,
  changeAthleteBillingTermsAction,
  applyGlobalDueDateExceptionAction,
  applyMonthlyChargeReductionAction,
  applyMonthlyChargeExtensionAction,
  type BillingCoachActionDependencies,
} from '../../lib/memberships/billing-coach-actions'

test('Coach action validates input before opening a transaction', async () => {
  let transactions = 0
  const dependencies: BillingCoachActionDependencies = {
    transaction: () => {
      transactions += 1
      throw new Error('transaction must not run')
    },
    createId: () => 'policy-a',
  }

  const result = await configureTeamEconomicPolicyAction({
    teamId: 'team-a',
    effectiveFrom: '2026-10-15',
    defaultMonthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    ordinaryDueDay: 5,
  }, dependencies)

  assert.equal(result.success, false)
  assert.equal(transactions, 0)
})

test('Coach action performs policy configuration inside one transaction', async () => {
  const calls: string[] = []
  const dependencies: BillingCoachActionDependencies = {
    createId: () => 'policy-b',
    transaction: (operation) => {
      calls.push('transaction:start')
      const result = operation({
        listTeamEconomicPolicies: (teamId) => {
          calls.push(`list:${teamId}`)
          return []
        },
        saveTeamEconomicPolicy: (policy) => {
          calls.push(`save:${policy.id}`)
        },
        replaceTeamEconomicPolicy: () => {
          throw new Error('unexpected replacement')
        },
      })
      calls.push('transaction:end')
      return result
    },
  }

  const result = await configureTeamEconomicPolicyAction({
    teamId: 'team-a',
    effectiveFrom: '2026-10-01',
    defaultMonthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    ordinaryDueDay: 5,
  }, dependencies)

  assert.deepEqual(result, { success: true })
  assert.deepEqual(calls, [
    'transaction:start',
    'list:team-a',
    'save:policy-b',
    'transaction:end',
  ])
})

test('Coach action returns a safe failure when transactional configuration fails', async () => {
  const dependencies: BillingCoachActionDependencies = {
    createId: () => 'policy-a',
    transaction: () => {
      throw new Error('database detail')
    },
  }

  const result = await configureTeamEconomicPolicyAction({
    teamId: 'team-a',
    effectiveFrom: '2026-10-01',
    defaultMonthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    ordinaryDueDay: 5,
  }, dependencies)

  assert.deepEqual(result, {
    success: false,
    error: 'Could not configure team economic policy',
  })
})


test('Coach action applies initial athlete billing terms inside one transaction', async () => {
  const calls: string[] = []
  const dependencies: BillingCoachActionDependencies = {
    createId: () => 'terms-a',
    transaction: (operation) => {
      calls.push('transaction:start')
      const result = operation({
        athleteBelongsToTeam: (teamId, athleteId) => {
          calls.push(`belongs:${teamId}:${athleteId}`)
          return true
        },
        listTeamEconomicPolicies: () => [{
          id: 'policy-a',
          teamId: 'team-a',
          defaultMonthlyAmountMinor: 2_500_000,
          currency: 'ARS',
          ordinaryDueDay: 5,
          effectiveFrom: '2026-10-01',
          effectiveUntil: null,
        }],
        listAthleteBillingTerms: () => [],
        saveAthleteBillingTerms: (terms) => {
          calls.push(`save:${terms.id}`)
        },
        replaceAthleteBillingTerms: () => {
          throw new Error('unexpected replacement')
        },
      })
      calls.push('transaction:end')
      return result
    },
  }

  const result = await applyInitialAthleteBillingTermsAction({
    teamId: 'team-a',
    athleteId: 'athlete-a',
    effectiveFrom: '2026-10-18',
  }, dependencies)

  assert.deepEqual(result, { success: true })
  assert.deepEqual(calls, [
    'transaction:start',
    'belongs:team-a:athlete-a',
    'save:terms-a',
    'transaction:end',
  ])
})

test('Coach action changes athlete billing terms inside one transaction', async () => {
  const calls: string[] = []
  const dependencies: BillingCoachActionDependencies = {
    createId: () => 'terms-b',
    transaction: (operation) => {
      const result = operation({
        athleteBelongsToTeam: () => true,
        listTeamEconomicPolicies: () => [],
        listAthleteBillingTerms: () => [{
          id: 'terms-a',
          athleteId: 'athlete-a',
          monthlyAmountMinor: 2_500_000,
          currency: 'ARS',
          effectiveFrom: '2026-10-18',
          effectiveUntil: null,
        }],
        saveAthleteBillingTerms: () => {},
        replaceAthleteBillingTerms: (current, replacement) => {
          calls.push(`${current.effectiveUntil}:${replacement.monthlyAmountMinor}`)
        },
      })
      return result
    },
  }

  const result = await changeAthleteBillingTermsAction({
    teamId: 'team-a',
    athleteId: 'athlete-a',
    effectiveFrom: '2026-11-01',
    monthlyAmountMinor: 3_000_000,
    currency: 'ARS',
  }, dependencies)

  assert.deepEqual(result, { success: true })
  assert.deepEqual(calls, ['2026-11-01:3000000'])
})


test('Coach action applies a global monthly due-date exception through the H2 persistence port', async () => {
  const calls: string[] = []
  const dependencies = {
    createId: () => 'global-exception-a',
    transaction: (operation: (repository: any) => unknown) => operation({
      applyGlobalDueDateExceptionAtomically: (
        teamId: string,
        year: number,
        month: number,
        revision: any,
      ) => {
        calls.push(`apply:${revision.id}:${teamId}:${year}-${month}:${revision.dueDate}:${revision.reason}`)
      },
    }),
  } as BillingCoachActionDependencies

  const result = await applyGlobalDueDateExceptionAction({
    teamId: 'team-a',
    year: 2026,
    month: 10,
    dueDate: '2026-10-10',
    reason: 'Feriado bancario',
  }, dependencies)

  assert.deepEqual(result, { success: true })
  assert.deepEqual(calls, [
    'apply:global-exception-a:team-a:2026-10:2026-10-10:Feriado bancario',
  ])
})

test('Coach global monthly due-date exception rejects incomplete input before opening a transaction', async () => {
  let transactions = 0
  const dependencies = {
    createId: () => 'global-exception-a',
    transaction: () => {
      transactions += 1
      throw new Error('transaction must not run')
    },
  } as BillingCoachActionDependencies

  const result = await applyGlobalDueDateExceptionAction({
    teamId: 'team-a',
    year: 2026,
    month: 10,
    dueDate: '2026-10-10',
    reason: '   ',
  }, dependencies)

  assert.equal(result.success, false)
  assert.equal(transactions, 0)
})


test('Coach actions delegate reduction and extension decisions to the established H2 ports', async () => {
  const calls: string[] = []
  let nextId = 0
  const dependencies = {
    createId: () => `h2-${++nextId}`,
    transaction: (operation: (repository: any) => unknown) => operation({
      listMonthlyCharges: () => [{
        athleteId: 'athlete-a',
        billingTermsId: 'terms-a',
        year: 2026,
        month: 10,
        baseAmountMinor: 2_500_000,
        amountDueMinor: 2_500_000,
        currency: 'ARS',
        baseDueDate: '2026-10-05',
        effectiveDueDate: '2026-10-05',
      }],
      listMonthlyChargeReductionRevisions: () => [],
      applyMonthlyChargeReductionAtomically: (
        teamId: string,
        monthlyChargeId: string,
        revision: any,
      ) => calls.push(`reduction:${teamId}:${monthlyChargeId}:${revision.id}:${revision.reductionAmountMinor}:${revision.reason}`),
      listMonthlyChargeExtensionRevisions: () => [],
      applyMonthlyChargeExtensionAtomically: (
        teamId: string,
        monthlyChargeId: string,
        revision: any,
      ) => calls.push(`extension:${teamId}:${monthlyChargeId}:${revision.id}:${revision.extendedDueDate}:${revision.reason}`),
    }),
  } as BillingCoachActionDependencies

  assert.deepEqual(await applyMonthlyChargeReductionAction({
    teamId: 'team-a',
    monthlyChargeId: 'charge-a',
    athleteId: 'athlete-a',
    year: 2026,
    month: 10,
    reductionAmountMinor: 500_000,
    reason: 'Beca deportiva',
  }, dependencies), { success: true })

  assert.deepEqual(await applyMonthlyChargeExtensionAction({
    teamId: 'team-a',
    monthlyChargeId: 'charge-a',
    athleteId: 'athlete-a',
    year: 2026,
    month: 10,
    extendedDueDate: '2026-10-15',
    reason: 'Prórroga acordada',
  }, dependencies), { success: true })

  assert.deepEqual(calls, [
    'reduction:team-a:charge-a:h2-1:500000:Beca deportiva',
    'extension:team-a:charge-a:h2-2:2026-10-15:Prórroga acordada',
  ])
})

test('Coach reduction and extension actions reject missing reasons before transaction', async () => {
  let transactions = 0
  const dependencies = {
    createId: () => 'unused',
    transaction: () => {
      transactions += 1
      throw new Error('transaction must not run')
    },
  } as BillingCoachActionDependencies

  const reduction = await applyMonthlyChargeReductionAction({
    teamId: 'team-a',
    monthlyChargeId: 'charge-a',
    athleteId: 'athlete-a',
    year: 2026,
    month: 10,
    reductionAmountMinor: 500_000,
    reason: '',
  }, dependencies)
  const extension = await applyMonthlyChargeExtensionAction({
    teamId: 'team-a',
    monthlyChargeId: 'charge-a',
    athleteId: 'athlete-a',
    year: 2026,
    month: 10,
    extendedDueDate: '2026-10-15',
    reason: '   ',
  }, dependencies)

  assert.equal(reduction.success, false)
  assert.equal(extension.success, false)
  assert.equal(transactions, 0)
})


test('Coach global exception reprojects existing materialized charges through the established H2 adapter', async () => {
  const calls: string[] = []
  const dependencies = {
    createId: () => 'global-exception-b',
    transaction: (operation: (repository: any) => unknown) => operation({
      listGlobalDueDateExceptionRevisions: () => [],
      listTeamMonthlyCharges: () => [{
        id: 'charge-a',
        athleteId: 'athlete-a',
        billingTermsId: 'terms-a',
        year: 2026,
        month: 10,
        baseAmountMinor: 2_500_000,
        amountDueMinor: 2_500_000,
        currency: 'ARS',
        baseDueDate: '2026-10-05',
        effectiveDueDate: '2026-10-15',
      }],
      getBillingTermsById: () => ({
        id: 'terms-a',
        athleteId: 'athlete-a',
        monthlyAmountMinor: 2_500_000,
        currency: 'ARS',
        effectiveFrom: '2026-10-01',
        effectiveUntil: null,
      }),
      listMonthlyChargeExtensionRevisions: () => [{
        id: 'extension-a',
        monthlyChargeId: 'charge-a',
        athleteId: 'athlete-a',
        year: 2026,
        month: 10,
        extendedDueDate: '2026-10-15',
        reason: 'Prórroga acordada',
        isCurrent: true,
      }],
      applyGlobalDueDateExceptionAtomically: (
        teamId: string,
        year: number,
        month: number,
        revision: any,
        charges: any[],
      ) => {
        calls.push(`apply:${teamId}:${year}-${month}:${revision.id}`)
        calls.push(`charge:${charges[0]?.baseDueDate}:${charges[0]?.effectiveDueDate}`)
      },
    }),
  } as BillingCoachActionDependencies

  const result = await applyGlobalDueDateExceptionAction({
    teamId: 'team-a',
    year: 2026,
    month: 10,
    dueDate: '2026-10-10',
    reason: 'Feriado bancario',
  }, dependencies)

  assert.deepEqual(result, { success: true })
  assert.deepEqual(calls, [
    'apply:team-a:2026-10:global-exception-b',
    'charge:2026-10-10:2026-10-15',
  ])
})
