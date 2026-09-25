import assert from 'node:assert/strict'
import test from 'node:test'

import { loadAthleteMembership } from '../../lib/memberships/athlete-membership-loader'

test('loads the scoped athlete billing snapshot and builds the membership view model', async () => {
  let snapshotReads = 0

  const model = await loadAthleteMembership({
    locale: 'es',
    teamId: 'team_1',
    athleteId: 'athlete-1',
    getSnapshot: async (input) => {
      snapshotReads += 1
      assert.deepEqual(input, {
        teamId: 'team_1',
        athleteId: 'athlete-1',
      })

      return {
        terms: [{
          id: 'terms-1',
          athleteId: 'athlete-1',
          monthlyAmountMinor: 2_500_000,
          currency: 'ARS',
          effectiveFrom: '2026-09-15',
          effectiveUntil: null,
        }],
        charges: [],
      }
    },
  })

  assert.equal(snapshotReads, 1)
  assert.equal(model.title, 'Membresía')
  assert.equal(model.currentTerms?.monthlyAmount, '$25.000')
})

test('athlete membership loader has no materialization dependency', async () => {
  const model = await loadAthleteMembership({
    locale: 'en',
    teamId: 'team_1',
    athleteId: 'athlete-1',
    getSnapshot: async () => ({
      terms: [],
      charges: [],
    }),
  })

  assert.equal(model.title, 'Membership')
  assert.equal(model.currentTerms, null)
})
