import assert from 'node:assert/strict'
import test from 'node:test'

import { createAthleteHomeEconomicReader } from '../../lib/memberships/athlete-home-economic-reader'

const makeCharge = (year: number, month: number, status: 'settled' | 'pending' | 'overdue', remainingMinor: number) =>
  ({ year, month, status, remainingMinor })

test('KAN-633 reads one scoped H4/H5 summary at the supplied Buenos Aires civil cutoff, not local clock', async () => {
  const calls: unknown[] = []
  const read = createAthleteHomeEconomicReader({ readAccount: async (input) => {
    calls.push(input)
    return { available: true, blockedForPriorDebt: false, charges: [
      makeCharge(2026, 9, 'settled', 0),
      makeCharge(2026, 10, 'pending', 500),
    ] }
  } })
  assert.deepEqual(await read({ teamId: 'team-a', athleteId: 'athlete-a', cutoffDate: '2026-10-06' }), {
    currentCharge: { status: 'pending', remainingMinor: 500 },
    blockedForPriorDebt: false,
    available: true,
  })
  assert.deepEqual(calls, [{ teamId: 'team-a', athleteId: 'athlete-a', cutoffDate: '2026-10-06' }])
})

test('KAN-633 retains H5 prior-debt priority when current month settled', async () => {
  const read = createAthleteHomeEconomicReader({ readAccount: async () => ({
    available: true, blockedForPriorDebt: true, charges: [
      makeCharge(2026, 9, 'overdue', 100),
      makeCharge(2026, 10, 'settled', 0),
    ],
  }) })
  const result = await read({ teamId: 'team-a', athleteId: 'athlete-a', cutoffDate: '2026-10-06' })
  assert.equal(result.blockedForPriorDebt, true)
  assert.deepEqual(result.currentCharge, { status: 'settled', remainingMinor: 0 })
})

test('KAN-633 reports absent charge or terms as unknown and does not synthesize settled', async () => {
  const read = createAthleteHomeEconomicReader({ readAccount: async () => ({
    available: false, blockedForPriorDebt: false, charges: [],
  }) })
  assert.deepEqual(await read({ teamId: 'team-a', athleteId: 'athlete-a', cutoffDate: '2026-10-06' }), {
    available: false, blockedForPriorDebt: false, currentCharge: null,
  })
})

test('KAN-633 does not leak an economic state after an upstream read failure', async () => {
  const read = createAthleteHomeEconomicReader({ readAccount: async () => { throw Error('database unavailable') } })
  assert.deepEqual(await read({ teamId: 'team-a', athleteId: 'athlete-a', cutoffDate: '2026-10-06' }), {
    available: false, blockedForPriorDebt: false, currentCharge: null,
  })
})
