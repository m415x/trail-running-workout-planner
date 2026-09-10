import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isCompetitionActiveForPlanning,
  validateCompetitionStatusTransition,
} from '@/lib/periodization/competition-lifecycle'

describe('competition lifecycle policy', () => {
  it('allows the MVP lifecycle transitions', () => {
    const allowedTransitions = [
      ['planned', 'confirmed'],
      ['planned', 'cancelled'],
      ['confirmed', 'completed'],
      ['confirmed', 'cancelled'],
    ] as const

    for (const [from, to] of allowedTransitions) {
      assert.deepEqual(validateCompetitionStatusTransition(from, to), { valid: true })
    }
  })

  it('keeps completed and cancelled as terminal states', () => {
    const terminalTransitions = [
      ['completed', 'planned'],
      ['completed', 'confirmed'],
      ['cancelled', 'planned'],
      ['cancelled', 'confirmed'],
    ] as const

    for (const [from, to] of terminalTransitions) {
      assert.deepEqual(validateCompetitionStatusTransition(from, to), {
        valid: false,
        error: 'competition_lifecycle_transition_not_allowed',
      })
    }
  })

  it('rejects direct or no-op transitions that bypass lifecycle meaning', () => {
    const invalidTransitions = [
      ['planned', 'completed'],
      ['confirmed', 'planned'],
      ['planned', 'planned'],
      ['confirmed', 'confirmed'],
    ] as const

    for (const [from, to] of invalidTransitions) {
      assert.deepEqual(validateCompetitionStatusTransition(from, to), {
        valid: false,
        error: 'competition_lifecycle_transition_not_allowed',
      })
    }
  })

  it('treats planned and confirmed as active planning context only', () => {
    assert.equal(isCompetitionActiveForPlanning('planned'), true)
    assert.equal(isCompetitionActiveForPlanning('confirmed'), true)
    assert.equal(isCompetitionActiveForPlanning('completed'), false)
    assert.equal(isCompetitionActiveForPlanning('cancelled'), false)
  })
})
