import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateSessionMicrocycleDate } from '@/lib/sessions/session-microcycle-boundary'

const candidate = (id: string, startDate: string, endDate: string) => ({ id, startDate, endDate })

describe('session create/edit microcycle date boundary', () => {
  it('accepts a selected microcycle on either inclusive boundary', () => {
    const selected = candidate('week_1', '2026-09-21', '2026-09-27')
    assert.equal(validateSessionMicrocycleDate('group_a', '2026-09-21', 'week_1', [selected]), null)
    assert.equal(validateSessionMicrocycleDate('group_a', '2026-09-27', 'week_1', [selected]), null)
  })

  it('rejects a selected microcycle after a session date changes', () => {
    assert.deepEqual(validateSessionMicrocycleDate('group_a', '2026-09-28', 'week_1', [
      candidate('week_1', '2026-09-21', '2026-09-27'),
    ]), { errorCode: 'microcycleDateMismatch', errorParams: { group: 'group_a' } })
  })

  it('rejects an arbitrary selection when two microcycles overlap', () => {
    assert.deepEqual(validateSessionMicrocycleDate('group_a', '2026-09-26', 'week_1', [
      candidate('week_1', '2026-09-21', '2026-09-27'),
      candidate('week_2', '2026-09-25', '2026-10-01'),
    ]), { errorCode: 'microcycleDateAmbiguous', errorParams: { group: 'group_a' } })
  })

  it('validates each group against its own candidates', () => {
    assert.equal(validateSessionMicrocycleDate('group_a', '2026-09-23', 'week_a', [
      candidate('week_a', '2026-09-21', '2026-09-27'),
    ]), null)
    assert.deepEqual(validateSessionMicrocycleDate('group_b', '2026-09-23', 'week_a', []), {
      errorCode: 'microcycleDateMismatch', errorParams: { group: 'group_b' },
    })
  })
})
