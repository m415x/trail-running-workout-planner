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

  assert.deepEqual(calls, [
    'policy:team_1',
    'revalidate:/dashboard/membership',
    'initial:team_1:athlete-a',
    'revalidate:/dashboard/athletes/athlete-a',
    'change:team_1:athlete-a',
    'revalidate:/en/dashboard/athletes/athlete-a',
  ])
})
