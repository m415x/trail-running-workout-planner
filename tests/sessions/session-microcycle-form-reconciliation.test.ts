import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { reconcileSessionFormMicrocycles } from '@/lib/sessions/session-microcycle-form-reconciliation'

const week = (id: string, startDate: string, endDate: string) => ({ id, startDate, endDate })

describe('session form microcycle reconciliation', () => {
  it('preselects the unique date-compatible microcycle for each group', () => {
    assert.deepEqual(reconcileSessionFormMicrocycles('2026-09-23', ['a', 'b'], {
      a: [week('a_1', '2026-09-21', '2026-09-27')],
      b: [week('b_1', '2026-09-22', '2026-09-28')],
    }), {
      a: { status: 'resolved', microcycleId: 'a_1' },
      b: { status: 'resolved', microcycleId: 'b_1' },
    })
  })

  it('clears stale selection when date moves outside a group interval', () => {
    assert.deepEqual(reconcileSessionFormMicrocycles('2026-09-28', ['a'], {
      a: [week('a_1', '2026-09-21', '2026-09-27')],
    }), { a: { status: 'unavailable', microcycleId: '' } })
  })

  it('never chooses between overlapping microcycles', () => {
    assert.deepEqual(reconcileSessionFormMicrocycles('2026-09-26', ['a'], {
      a: [week('a_1', '2026-09-21', '2026-09-27'), week('a_2', '2026-09-25', '2026-10-01')],
    }), { a: { status: 'ambiguous', microcycleId: '' } })
  })

  it('reconciles only selected groups when group selection changes', () => {
    assert.deepEqual(reconcileSessionFormMicrocycles('2026-09-23', ['b'], {
      a: [week('a_1', '2026-09-21', '2026-09-27')],
      b: [],
    }), { b: { status: 'unavailable', microcycleId: '' } })
  })
})
