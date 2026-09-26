import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createMembershipActionHandlers,
} from '../../lib/memberships/membership-action-handlers'

test('membership action handlers enforce current team scope and revalidate Coach surfaces', async () => {
  const calls: string[] = []
  const runtime = {
    configureTeamEconomicPolicy: async (input: Record<string, unknown>) => {
      calls.push(`policy:${String(input.teamId)}`)
      return { success: true as const }
    },
    applyInitialAthleteBillingTerms: async (input: Record<string, unknown>) => {
      calls.push(`initial:${String(input.teamId)}:${String(input.athleteId)}`)
      return { success: true as const }
    },
    changeAthleteBillingTerms: async (input: Record<string, unknown>) => {
      calls.push(`change:${String(input.teamId)}:${String(input.athleteId)}`)
      return { success: true as const }
    },
    applyGlobalDueDateException: async (input: Record<string, unknown>) => {
      calls.push(`global:${String(input.teamId)}:${String(input.year)}-${String(input.month)}`)
      return { success: true as const }
    },
    applyMonthlyChargeReduction: async (input: Record<string, unknown>) => {
      calls.push(`reduction:${String(input.teamId)}:${String(input.monthlyChargeId)}`)
      return { success: true as const }
    },
    applyMonthlyChargeExtension: async (input: Record<string, unknown>) => {
      calls.push(`extension:${String(input.teamId)}:${String(input.monthlyChargeId)}`)
      return { success: true as const }
    },
  }

  const actions = createMembershipActionHandlers({
    teamId: 'team_1',
    runtime,
    revalidatePath: (path) => calls.push(`revalidate:${path}`),
  })

  await actions.configureTeamEconomicPolicy({
    effectiveFrom: '2026-10-01',
    defaultMonthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    ordinaryDueDay: 5,
  })
  await actions.applyInitialAthleteBillingTerms({
    athleteId: 'athlete-a',
    effectiveFrom: '2026-10-18',
    locale: 'es',
  })
  await actions.changeAthleteBillingTerms({
    athleteId: 'athlete-a',
    effectiveFrom: '2026-11-01',
    monthlyAmountMinor: 3_000_000,
    currency: 'ARS',
    locale: 'en',
  })

  await actions.applyGlobalDueDateException({
    year: 2026,
    month: 10,
    dueDate: '2026-10-10',
    reason: 'Feriado bancario',
    locale: 'en',
  })
  await actions.applyMonthlyChargeReduction({
    monthlyChargeId: 'charge-a',
    athleteId: 'athlete-a',
    year: 2026,
    month: 10,
    reductionAmountMinor: 500_000,
    reason: 'Beca deportiva',
    locale: 'es',
  })
  await actions.applyMonthlyChargeExtension({
    monthlyChargeId: 'charge-a',
    athleteId: 'athlete-a',
    year: 2026,
    month: 10,
    extendedDueDate: '2026-10-15',
    reason: 'Prórroga acordada',
    locale: 'en',
  })

  assert.deepEqual(calls, [
    'policy:team_1',
    'revalidate:/dashboard/membership',
    'initial:team_1:athlete-a',
    'revalidate:/dashboard/athletes/athlete-a',
    'change:team_1:athlete-a',
    'revalidate:/en/dashboard/athletes/athlete-a',
    'global:team_1:2026-10',
    'revalidate:/en/dashboard/membership',
    'reduction:team_1:charge-a',
    'revalidate:/dashboard/athletes/athlete-a',
    'extension:team_1:charge-a',
    'revalidate:/en/dashboard/athletes/athlete-a',
  ])
})
