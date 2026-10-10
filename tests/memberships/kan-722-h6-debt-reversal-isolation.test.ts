import assert from 'node:assert/strict'
import test from 'node:test'

import { projectH6TeamDebtSnapshot } from '@/lib/memberships/h6-debt-reversal-isolation'

const charge = { id: 'charge_a', athleteProfileId: 'athlete_a', teamId: 'team_a', year: 2026, month: 9, amountDueMinor: 300, effectiveDueDate: '2026-09-05' }
const input = {
  teamId: 'team_a',
  athleteProfileId: 'athlete_a',
  charges: [charge, { ...charge, id: 'charge_foreign', athleteProfileId: 'athlete_b', teamId: 'team_b', amountDueMinor: 999 }],
  revisions: [] as Array<{ paymentId: string; monthlyChargeId: string; amountMinor: number; voided: boolean; isCurrent: boolean }>,
}

test('KAN-722 payment settlement, correction and void are recalculated from current revisions', () => {
  const base = { ...input, charges: [charge] }
  assert.deepEqual(projectH6TeamDebtSnapshot(base), [{ year: 2026, month: 9, remainingMinor: 300, effectiveDueDate: '2026-09-05' }])
  const settled = { ...base, revisions: [{ paymentId: 'payment_a', monthlyChargeId: 'charge_a', amountMinor: 300, voided: false, isCurrent: true }] }
  assert.equal(projectH6TeamDebtSnapshot(settled)?.[0]?.remainingMinor, 0)
  const corrected = { ...settled, revisions: [
    { ...settled.revisions[0]!, isCurrent: false },
    { ...settled.revisions[0]!, amountMinor: 100 },
  ] }
  assert.equal(projectH6TeamDebtSnapshot(corrected)?.[0]?.remainingMinor, 200)
  const voided = { ...corrected, revisions: [{ ...settled.revisions[0]!, voided: true }] }
  assert.equal(projectH6TeamDebtSnapshot(voided)?.[0]?.remainingMinor, 300)
})

test('KAN-722 a foreign Team/AthleteProfile can never change SELF debt evidence', () => {
  assert.equal(projectH6TeamDebtSnapshot(input)?.length, 1)
  assert.equal(projectH6TeamDebtSnapshot({
    ...input, revisions: [{ paymentId: 'foreign', monthlyChargeId: 'charge_foreign', amountMinor: 999, voided: false, isCurrent: true }],
  })?.[0]?.remainingMinor, 300)
  assert.equal(projectH6TeamDebtSnapshot({ ...input, teamId: 'team_b', athleteProfileId: 'athlete_a' }), null)
})

test('KAN-722 inconsistent current revisions fail closed instead of inventing settlement', () => {
  const payment = { paymentId: 'p', monthlyChargeId: 'charge_a', amountMinor: 150, voided: false, isCurrent: true }
  assert.equal(projectH6TeamDebtSnapshot({ ...input, revisions: [payment, payment] }), null)
  assert.equal(projectH6TeamDebtSnapshot({ ...input, revisions: [{ ...payment, amountMinor: 500 }] }), null)
})
