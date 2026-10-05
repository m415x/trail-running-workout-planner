import assert from 'node:assert/strict'
import test from 'node:test'

import { projectAthleteEconomicVisualState } from '../../lib/memberships/athlete-home-economic-visual'

type Status = 'settled' | 'pending' | 'overdue'
const current = (status: Status, remainingMinor: number) => ({ status, remainingMinor })
const project = (charge: ReturnType<typeof current> | null, blockedForPriorDebt = false) =>
  projectAthleteEconomicVisualState({ currentCharge: charge, blockedForPriorDebt, available: true })

test('KAN-632: settled current charge retains normal shell colors', () => {
  assert.deepEqual(project(current('settled', 0)), { tone: 'normal', message: 'current_settled' })
})

test('KAN-632: H4 pending and overdue with positive balance map to warning and danger', () => {
  assert.deepEqual(project(current('pending', 100)), { tone: 'warning', message: 'current_pending' })
  assert.deepEqual(project(current('overdue', 100)), { tone: 'danger', message: 'current_overdue' })
})

test('KAN-632: H5 prior overdue debt wins even when the current charge is settled or absent', () => {
  assert.deepEqual(project(current('settled', 0), true), { tone: 'danger', message: 'prior_overdue_debt' })
  assert.deepEqual(project(current('pending', 100), true), { tone: 'danger', message: 'prior_overdue_debt' })
  assert.deepEqual(project(null, true), { tone: 'danger', message: 'prior_overdue_debt' })
})

test('KAN-632: missing terms, no materialized charge, load failures and unknown information never become implicitly settled', () => {
  assert.deepEqual(project(null), { tone: 'neutral', message: 'account_unknown' })
  assert.deepEqual(projectAthleteEconomicVisualState({ currentCharge: null, blockedForPriorDebt: false, available: false }), { tone: 'neutral', message: 'account_unknown' })
})

test('KAN-632: visual mapping consumes H4/H5 projection without recasting dates, discounts, extensions or payments', () => {
  // A date extension changes H4 overdue to pending upstream, not in this mapper.
  assert.equal(project(current('pending', 1800)).tone, 'warning')
  assert.equal(project(current('overdue', 1800)).tone, 'danger')
  // Paid/reduced-to-zero must already be settled by H4.
  assert.equal(project(current('settled', 0)).tone, 'normal')
  // Contradictory external projection is treated as unknown instead of inventing a new economic rule.
  assert.equal(project(current('settled', 1800)).tone, 'neutral')
  assert.equal(project(current('pending', 0)).tone, 'neutral')
})

test('KAN-632: mapper is pure and needs neither browser nor local clock', () => {
  const input = Object.freeze({ available: true, blockedForPriorDebt: false, currentCharge: Object.freeze(current('pending', 100)) })
  assert.deepEqual(projectAthleteEconomicVisualState(input), projectAthleteEconomicVisualState(input))
})
