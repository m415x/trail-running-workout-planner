import assert from 'node:assert/strict'
import test from 'node:test'

import { evaluateH6PriorDebt } from '@/lib/memberships/h6-prior-debt-self-guard'

const subject = { teamId: 'team_a', athleteProfileId: 'athlete_a' }
const cutoffDate = '2026-10-09'

type Charge = { year: number; month: number; remainingMinor: number; effectiveDueDate: string }

function evaluate(charges: Charge[] | null, failed = false) {
  return evaluateH6PriorDebt({
    ...subject,
    cutoffDate,
    loadCharges: async (teamId, athleteProfileId) => {
      assert.equal(teamId, subject.teamId)
      assert.equal(athleteProfileId, subject.athleteProfileId)
      if (failed) throw new Error('billing read unavailable')
      return charges
    },
  })
}

test('KAN-720 blocks only an effectively overdue charge from a prior civil month', async () => {
  assert.deepEqual(await evaluate([{ year: 2026, month: 9, remainingMinor: 100, effectiveDueDate: '2026-10-08' }]), { status: 'blocked' })
  assert.deepEqual(await evaluate([{ year: 2026, month: 9, remainingMinor: 100, effectiveDueDate: '2026-10-09' }]), { status: 'allowed' })
  assert.deepEqual(await evaluate([{ year: 2026, month: 9, remainingMinor: 100, effectiveDueDate: '2026-10-20' }]), { status: 'allowed' })
  assert.deepEqual(await evaluate([{ year: 2026, month: 10, remainingMinor: 100, effectiveDueDate: '2026-10-01' }]), { status: 'allowed' })
  assert.deepEqual(await evaluate([{ year: 2026, month: 9, remainingMinor: 0, effectiveDueDate: '2026-09-05' }]), { status: 'allowed' })
})

test('KAN-720 never invents debt from missing, invalid or failed economic evidence', async () => {
  assert.deepEqual(await evaluate(null), { status: 'unavailable' })
  assert.deepEqual(await evaluate([], true), { status: 'unavailable' })
  assert.deepEqual(await evaluate([{ year: 2026, month: 9, remainingMinor: -1, effectiveDueDate: '2026-09-05' }]), { status: 'unavailable' })
  assert.deepEqual(await evaluate([{ year: 2026, month: 9, remainingMinor: 20, effectiveDueDate: 'not-a-date' }]), { status: 'unavailable' })
})

test('KAN-720 recomputes after settlement, reversal or extension without persisted flag', async () => {
  let charges = [{ year: 2026, month: 9, remainingMinor: 100, effectiveDueDate: '2026-09-05' }]
  const decide = () => evaluate(charges)
  assert.deepEqual(await decide(), { status: 'blocked' })
  charges = [{ ...charges[0]!, remainingMinor: 0 }]
  assert.deepEqual(await decide(), { status: 'allowed' })
  charges = [{ ...charges[0]!, remainingMinor: 100 }]
  assert.deepEqual(await decide(), { status: 'blocked' })
  charges = [{ ...charges[0]!, effectiveDueDate: '2026-10-20' }]
  assert.deepEqual(await decide(), { status: 'allowed' })
})
