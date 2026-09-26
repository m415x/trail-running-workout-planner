import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createBillingPersistenceAdapter,
  type BillingPersistencePort,
} from '../../lib/memberships/billing-persistence'

test('billing persistence adapter scopes athlete reads to team and maps H1 records', async () => {
  const calls: Array<[string, string, string?]> = []
  const port: BillingPersistencePort = {
    athleteBelongsToTeam: async (teamId, athleteId) => {
      calls.push(['belongs', teamId, athleteId])
      return true
    },
    listBillingTerms: async (teamId, athleteId) => {
      calls.push(['terms', teamId, athleteId])
      return []
    },
    listMonthlyCharges: async (teamId, athleteId) => {
      calls.push(['charges', teamId, athleteId])
      return []
    },
    listTeamEconomicPolicies: async (teamId) => {
      calls.push(['policies', teamId])
      return []
    },
    insertMonthlyCharges: async () => {},
  }

  const adapter = createBillingPersistenceAdapter(port)
  const snapshot = await adapter.getAthleteBillingSnapshot({
    teamId: 'team-a',
    athleteId: 'athlete-a',
  })

  assert.deepEqual(snapshot, { terms: [], charges: [] })
  assert.deepEqual(calls, [
    ['belongs', 'team-a', 'athlete-a'],
    ['terms', 'team-a', 'athlete-a'],
    ['charges', 'team-a', 'athlete-a'],
  ])
})

test('billing persistence adapter rejects cross-team reads before economic queries', async () => {
  const calls: string[] = []
  const port: BillingPersistencePort = {
    athleteBelongsToTeam: async () => {
      calls.push('belongs')
      return false
    },
    listBillingTerms: async () => {
      calls.push('terms')
      return []
    },
    listMonthlyCharges: async () => {
      calls.push('charges')
      return []
    },
    listTeamEconomicPolicies: async () => [],
    insertMonthlyCharges: async () => {},
  }

  const adapter = createBillingPersistenceAdapter(port)

  await assert.rejects(
    () => adapter.getAthleteBillingSnapshot({ teamId: 'team-b', athleteId: 'athlete-a' }),
    /athlete.*team/i,
  )
  assert.deepEqual(calls, ['belongs'])
})

test('billing persistence adapter materializes with team-scoped policies and athlete data', async () => {
  const calls: string[] = []
  const port: BillingPersistencePort = {
    athleteBelongsToTeam: async (teamId, athleteId) =>
      teamId === 'team-a' && athleteId === 'athlete-a',
    listBillingTerms: async () => [{
      id: 'terms-a',
      athleteId: 'athlete-a',
      monthlyAmountMinor: 2_500_000,
      currency: 'ARS',
      effectiveFrom: '2026-10-18',
      effectiveUntil: null,
    }],
    listMonthlyCharges: async () => [],
    listTeamEconomicPolicies: async (teamId) => {
      calls.push(`policies:${teamId}`)
      return [{
        id: 'policy-a',
        teamId,
        defaultMonthlyAmountMinor: 2_500_000,
        currency: 'ARS',
        ordinaryDueDay: 5,
        effectiveFrom: '2026-10-01',
        effectiveUntil: null,
      }]
    },
    insertMonthlyCharges: async (teamId, athleteId, charges) => {
      calls.push(`insert:${teamId}:${athleteId}:${charges.length}`)
    },
  }

  const adapter = createBillingPersistenceAdapter(port)
  const result = await adapter.materializeMonthlyCharges({
    teamId: 'team-a',
    athleteId: 'athlete-a',
    through: { year: 2026, month: 10 },
  })

  assert.equal(result.length, 1)
  assert.deepEqual(calls, ['policies:team-a', 'insert:team-a:athlete-a:1'])
})


test('global due-date exception service updates an already materialized charge base date without changing its amount', async () => {
  const updates: Array<{ baseDueDate: string; effectiveDueDate: string; amountDueMinor: number }> = []
  const port = {
    athleteBelongsToTeam: async () => true,
    listBillingTerms: async () => [{
      id: 'terms-a',
      athleteId: 'athlete-a',
      monthlyAmountMinor: 2_500_000,
      currency: 'ARS',
      effectiveFrom: '2026-10-18',
      effectiveUntil: null,
    }],
    listMonthlyCharges: async () => [{
      athleteId: 'athlete-a',
      billingTermsId: 'terms-a',
      year: 2026,
      month: 10,
      baseAmountMinor: 2_500_000,
      amountDueMinor: 2_500_000,
      currency: 'ARS',
      baseDueDate: '2026-10-18',
      effectiveDueDate: '2026-10-18',
    }],
    listTeamEconomicPolicies: async () => [],
    insertMonthlyCharges: async () => {},
    listGlobalDueDateExceptionRevisions: async () => [],
    replaceCurrentGlobalDueDateException: async () => {},
    listTeamMonthlyCharges: async () => [{
      athleteId: 'athlete-a',
      billingTermsId: 'terms-a',
      year: 2026,
      month: 10,
      baseAmountMinor: 2_500_000,
      amountDueMinor: 2_500_000,
      currency: 'ARS',
      baseDueDate: '2026-10-18',
      effectiveDueDate: '2026-10-18',
    }],
    getBillingTermsById: async () => ({
      id: 'terms-a',
      athleteId: 'athlete-a',
      monthlyAmountMinor: 2_500_000,
      currency: 'ARS',
      effectiveFrom: '2026-10-18',
      effectiveUntil: null,
    }),
    updateMonthlyChargeDueDates: async (_teamId: string, charge: {
      baseDueDate: string
      effectiveDueDate: string
      amountDueMinor: number
    }) => {
      updates.push(charge)
    },
  }

  const adapter = createBillingPersistenceAdapter(port)
  await adapter.applyGlobalDueDateException({
    teamId: 'team-a',
    year: 2026,
    month: 10,
    revision: {
      id: 'exception-1',
      teamId: 'team-a',
      year: 2026,
      month: 10,
      dueDate: '2026-10-10',
      reason: 'Vencimiento excepcional',
      isCurrent: true,
    },
  })

  assert.equal(updates.length, 1)
  assert.equal(updates[0].baseDueDate, '2026-10-18')
  assert.equal(updates[0].effectiveDueDate, '2026-10-18')
  assert.equal(updates[0].amountDueMinor, 2_500_000)
})


test('materialization applies the current global due-date exception to future charges', async () => {
  const inserted: Array<{ baseDueDate: string; effectiveDueDate: string }> = []
  const port = {
    athleteBelongsToTeam: async () => true,
    listBillingTerms: async () => [{
      id: 'terms-a',
      athleteId: 'athlete-a',
      monthlyAmountMinor: 2_500_000,
      currency: 'ARS',
      effectiveFrom: '2026-09-01',
      effectiveUntil: null,
    }],
    listMonthlyCharges: async () => [],
    listTeamEconomicPolicies: async () => [{
      id: 'policy-a',
      teamId: 'team-a',
      defaultMonthlyAmountMinor: 2_500_000,
      currency: 'ARS',
      ordinaryDueDay: 5,
      effectiveFrom: '2026-09-01',
      effectiveUntil: null,
    }],
    insertMonthlyCharges: async (_teamId: string, _athleteId: string, charges: Array<{
      baseDueDate: string
      effectiveDueDate: string
    }>) => {
      inserted.push(...charges)
    },
    listGlobalDueDateExceptionRevisions: async (_teamId: string, year: number, month: number) =>
      year === 2026 && month === 10
        ? [{
            id: 'exception-1',
            teamId: 'team-a',
            year: 2026,
            month: 10,
            dueDate: '2026-10-15',
            reason: 'Vencimiento excepcional',
            isCurrent: true,
          }]
        : [],
    replaceCurrentGlobalDueDateException: async () => {},
    listTeamMonthlyCharges: async () => [],
    getBillingTermsById: async () => {
      throw new Error('not used')
    },
    updateMonthlyChargeDueDates: async () => {},
  }

  const adapter = createBillingPersistenceAdapter(port)
  await adapter.materializeMonthlyCharges({
    teamId: 'team-a',
    athleteId: 'athlete-a',
    through: { year: 2026, month: 10 },
  })

  const october = inserted.find((charge) => charge.baseDueDate === '2026-10-15')
  assert.ok(october)
  assert.equal(october.effectiveDueDate, '2026-10-15')
})


test('global due-date exception preserves a later effective due date from an existing individual extension', async () => {
  const updates: Array<{ baseDueDate: string; effectiveDueDate: string }> = []
  const port = {
    athleteBelongsToTeam: async () => true,
    listBillingTerms: async () => [],
    listMonthlyCharges: async () => [],
    listTeamEconomicPolicies: async () => [],
    insertMonthlyCharges: async () => {},
    listGlobalDueDateExceptionRevisions: async () => [],
    replaceCurrentGlobalDueDateException: async () => {},
    listTeamMonthlyCharges: async () => [{
      athleteId: 'athlete-a',
      billingTermsId: 'terms-a',
      year: 2026,
      month: 10,
      baseAmountMinor: 2_500_000,
      amountDueMinor: 2_500_000,
      currency: 'ARS',
      baseDueDate: '2026-10-05',
      effectiveDueDate: '2026-10-25',
    }],
    getBillingTermsById: async () => ({
      id: 'terms-a',
      athleteId: 'athlete-a',
      monthlyAmountMinor: 2_500_000,
      currency: 'ARS',
      effectiveFrom: '2026-09-01',
      effectiveUntil: null,
    }),
    updateMonthlyChargeDueDates: async (_teamId: string, charge: {
      baseDueDate: string
      effectiveDueDate: string
    }) => {
      updates.push(charge)
    },
  }

  const adapter = createBillingPersistenceAdapter(port)
  await adapter.applyGlobalDueDateException({
    teamId: 'team-a',
    year: 2026,
    month: 10,
    revision: {
      id: 'exception-2',
      teamId: 'team-a',
      year: 2026,
      month: 10,
      dueDate: '2026-10-15',
      reason: 'Nuevo vencimiento global',
      isCurrent: true,
    },
  })

  assert.equal(updates.length, 1)
  assert.equal(updates[0].baseDueDate, '2026-10-15')
  assert.equal(updates[0].effectiveDueDate, '2026-10-25')
})


test('global due-date exception application uses the atomic persistence boundary', async () => {
  let atomicCalls = 0
  let separateWrites = 0
  const port = {
    athleteBelongsToTeam: async () => true,
    listBillingTerms: async () => [],
    listMonthlyCharges: async () => [],
    listTeamEconomicPolicies: async () => [],
    insertMonthlyCharges: async () => {},
    listGlobalDueDateExceptionRevisions: async () => [],
    replaceCurrentGlobalDueDateException: async () => {
      separateWrites += 1
    },
    listTeamMonthlyCharges: async () => [{
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
    getBillingTermsById: async () => ({
      id: 'terms-a',
      athleteId: 'athlete-a',
      monthlyAmountMinor: 2_500_000,
      currency: 'ARS',
      effectiveFrom: '2026-09-01',
      effectiveUntil: null,
    }),
    updateMonthlyChargeDueDates: async () => {
      separateWrites += 1
    },
    applyGlobalDueDateExceptionAtomically: async (
      _teamId: string,
      _year: number,
      _month: number,
      _revision: unknown,
      charges: Array<{ baseDueDate: string; effectiveDueDate: string }>,
    ) => {
      atomicCalls += 1
      assert.equal(charges.length, 1)
      assert.equal(charges[0].baseDueDate, '2026-10-15')
      assert.equal(charges[0].effectiveDueDate, '2026-10-15')
    },
  }

  const adapter = createBillingPersistenceAdapter(port)
  await adapter.applyGlobalDueDateException({
    teamId: 'team-a',
    year: 2026,
    month: 10,
    revision: {
      id: 'exception-atomic',
      teamId: 'team-a',
      year: 2026,
      month: 10,
      dueDate: '2026-10-15',
      reason: 'Vencimiento excepcional',
      isCurrent: true,
    },
  })

  assert.equal(atomicCalls, 1)
  assert.equal(separateWrites, 0)
})


test('global due-date exception rejects a blank audit reason before persistence', async () => {
  let persisted = false
  const port = {
    athleteBelongsToTeam: async () => true,
    listBillingTerms: async () => [],
    listMonthlyCharges: async () => [],
    listTeamEconomicPolicies: async () => [],
    insertMonthlyCharges: async () => {},
    listGlobalDueDateExceptionRevisions: async () => [],
    replaceCurrentGlobalDueDateException: async () => {
      persisted = true
    },
    listTeamMonthlyCharges: async () => [],
    getBillingTermsById: async () => {
      throw new Error('not used')
    },
    updateMonthlyChargeDueDates: async () => {
      persisted = true
    },
    applyGlobalDueDateExceptionAtomically: async () => {
      persisted = true
    },
  }

  const adapter = createBillingPersistenceAdapter(port)

  await assert.rejects(
    () => adapter.applyGlobalDueDateException({
      teamId: 'team-a',
      year: 2026,
      month: 10,
      revision: {
        id: 'exception-invalid',
        teamId: 'team-a',
        year: 2026,
        month: 10,
        dueDate: '2026-10-15',
        reason: '   ',
        isCurrent: true,
      },
    }),
    /reason/i,
  )
  assert.equal(persisted, false)
})


test('monthly charge reduction derives amount due without mutating the base amount', async () => {
  let applied: { baseAmountMinor: number; amountDueMinor: number } | undefined
  const port = {
    athleteBelongsToTeam: async () => true,
    listBillingTerms: async () => [],
    listMonthlyCharges: async () => [{
      athleteId: 'athlete-a',
      billingTermsId: 'terms-a',
      year: 2026,
      month: 10,
      baseAmountMinor: 2_500_000,
      amountDueMinor: 2_500_000,
      currency: 'ARS',
      baseDueDate: '2026-10-10',
      effectiveDueDate: '2026-10-10',
    }],
    listTeamEconomicPolicies: async () => [],
    insertMonthlyCharges: async () => {},
    listMonthlyChargeReductionRevisions: async () => [],
    replaceCurrentMonthlyChargeReduction: async () => {},
    applyMonthlyChargeReductionAtomically: async (
      _teamId: string,
      _monthlyChargeId: string,
      _revision: unknown,
      charge: { baseAmountMinor: number; amountDueMinor: number },
    ) => {
      applied = charge
    },
  }

  const adapter = createBillingPersistenceAdapter(port)
  await adapter.applyMonthlyChargeReduction({
    teamId: 'team-a',
    monthlyChargeId: 'charge-a',
    revision: {
      id: 'reduction-1',
      athleteId: 'athlete-a',
      year: 2026,
      month: 10,
      reductionAmountMinor: 500_000,
      reason: 'Beca deportiva',
      isCurrent: true,
    },
  })

  assert.ok(applied)
  assert.equal(applied.baseAmountMinor, 2_500_000)
  assert.equal(applied.amountDueMinor, 2_000_000)
})

test('monthly charge reduction supports a total reduction without producing a negative amount due', async () => {
  let amountDueMinor: number | undefined
  const port = {
    athleteBelongsToTeam: async () => true,
    listBillingTerms: async () => [],
    listMonthlyCharges: async () => [{
      athleteId: 'athlete-a',
      billingTermsId: 'terms-a',
      year: 2026,
      month: 10,
      baseAmountMinor: 2_500_000,
      amountDueMinor: 2_500_000,
      currency: 'ARS',
      baseDueDate: '2026-10-10',
      effectiveDueDate: '2026-10-10',
    }],
    listTeamEconomicPolicies: async () => [],
    insertMonthlyCharges: async () => {},
    listMonthlyChargeReductionRevisions: async () => [],
    replaceCurrentMonthlyChargeReduction: async () => {},
    applyMonthlyChargeReductionAtomically: async (
      _teamId: string,
      _monthlyChargeId: string,
      _revision: unknown,
      charge: { amountDueMinor: number },
    ) => {
      amountDueMinor = charge.amountDueMinor
    },
  }

  const adapter = createBillingPersistenceAdapter(port)
  await adapter.applyMonthlyChargeReduction({
    teamId: 'team-a',
    monthlyChargeId: 'charge-a',
    revision: {
      id: 'reduction-total',
      athleteId: 'athlete-a',
      year: 2026,
      month: 10,
      reductionAmountMinor: 2_500_000,
      reason: 'Beca total',
      isCurrent: true,
    },
  })

  assert.equal(amountDueMinor, 0)
})


test('withdrawing a monthly charge reduction restores amount due to the immutable base amount', async () => {
  let projected: { baseAmountMinor: number; amountDueMinor: number } | undefined
  const port = {
    athleteBelongsToTeam: async () => true,
    listBillingTerms: async () => [],
    listMonthlyCharges: async () => [{
      athleteId: 'athlete-a',
      billingTermsId: 'terms-a',
      year: 2026,
      month: 10,
      baseAmountMinor: 2_500_000,
      amountDueMinor: 2_000_000,
      currency: 'ARS',
      baseDueDate: '2026-10-10',
      effectiveDueDate: '2026-10-10',
    }],
    listTeamEconomicPolicies: async () => [],
    insertMonthlyCharges: async () => {},
    listMonthlyChargeReductionRevisions: async () => [{
      id: 'reduction-current',
      monthlyChargeId: 'charge-a',
      athleteId: 'athlete-a',
      year: 2026,
      month: 10,
      reductionAmountMinor: 500_000,
      reason: 'Beca deportiva',
      isCurrent: true,
    }],
    replaceCurrentMonthlyChargeReduction: async () => {},
    applyMonthlyChargeReductionAtomically: async (
      _teamId: string,
      _monthlyChargeId: string,
      _revision: unknown,
      charge: { baseAmountMinor: number; amountDueMinor: number },
    ) => {
      projected = charge
    },
  }

  const adapter = createBillingPersistenceAdapter(port)
  await adapter.applyMonthlyChargeReduction({
    teamId: 'team-a',
    monthlyChargeId: 'charge-a',
    revision: {
      id: 'reduction-withdrawn',
      athleteId: 'athlete-a',
      year: 2026,
      month: 10,
      reductionAmountMinor: 0,
      reason: 'Finaliza la beca',
      isCurrent: true,
    },
  })

  assert.ok(projected)
  assert.equal(projected.baseAmountMinor, 2_500_000)
  assert.equal(projected.amountDueMinor, 2_500_000)
})

test('monthly charge reduction rejects an amount above the immutable base before persistence', async () => {
  let persisted = false
  const port = {
    athleteBelongsToTeam: async () => true,
    listBillingTerms: async () => [],
    listMonthlyCharges: async () => [{
      athleteId: 'athlete-a',
      billingTermsId: 'terms-a',
      year: 2026,
      month: 10,
      baseAmountMinor: 2_500_000,
      amountDueMinor: 2_000_000,
      currency: 'ARS',
      baseDueDate: '2026-10-10',
      effectiveDueDate: '2026-10-10',
    }],
    listTeamEconomicPolicies: async () => [],
    insertMonthlyCharges: async () => {},
    listMonthlyChargeReductionRevisions: async () => [],
    replaceCurrentMonthlyChargeReduction: async () => {},
    applyMonthlyChargeReductionAtomically: async () => {
      persisted = true
    },
  }

  const adapter = createBillingPersistenceAdapter(port)
  await assert.rejects(
    () => adapter.applyMonthlyChargeReduction({
      teamId: 'team-a',
      monthlyChargeId: 'charge-a',
      revision: {
        id: 'reduction-invalid',
        athleteId: 'athlete-a',
        year: 2026,
        month: 10,
        reductionAmountMinor: 2_500_001,
        reason: 'Importe inválido',
        isCurrent: true,
      },
    }),
    /reduction|base|amount/i,
  )
  assert.equal(persisted, false)
})


test('monthly charge reduction uses persisted current history when correcting an existing reduction', async () => {
  let projectedAmount: number | undefined
  let historyReads = 0
  const port = {
    athleteBelongsToTeam: async () => true,
    listBillingTerms: async () => [],
    listMonthlyCharges: async () => [{
      athleteId: 'athlete-a',
      billingTermsId: 'terms-a',
      year: 2026,
      month: 10,
      baseAmountMinor: 2_500_000,
      amountDueMinor: 2_000_000,
      currency: 'ARS',
      baseDueDate: '2026-10-10',
      effectiveDueDate: '2026-10-10',
    }],
    listTeamEconomicPolicies: async () => [],
    insertMonthlyCharges: async () => {},
    listMonthlyChargeReductionRevisions: async () => {
      historyReads += 1
      return [{
        id: 'reduction-old',
        monthlyChargeId: 'charge-a',
        athleteId: 'athlete-a',
        year: 2026,
        month: 10,
        reductionAmountMinor: 500_000,
        reason: 'Beca inicial',
        isCurrent: true,
      }]
    },
    replaceCurrentMonthlyChargeReduction: async () => {},
    applyMonthlyChargeReductionAtomically: async (
      _teamId: string,
      _monthlyChargeId: string,
      _revision: unknown,
      charge: { amountDueMinor: number },
    ) => {
      projectedAmount = charge.amountDueMinor
    },
  }

  const adapter = createBillingPersistenceAdapter(port)
  await adapter.applyMonthlyChargeReduction({
    teamId: 'team-a',
    monthlyChargeId: 'charge-a',
    revision: {
      id: 'reduction-corrected',
      athleteId: 'athlete-a',
      year: 2026,
      month: 10,
      reductionAmountMinor: 750_000,
      reason: 'Corrección de beca',
      isCurrent: true,
    },
  })

  assert.equal(historyReads, 1)
  assert.equal(projectedAmount, 1_750_000)
})
