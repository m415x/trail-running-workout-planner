import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { resolveSessionMicrocycle } from '@/lib/sessions/session-microcycle-resolution'

const microcycle = (id: string, startDate: string, endDate: string) => ({
  id,
  startDate,
  endDate,
})

describe('date-scoped session microcycle resolution', () => {
  it('resolves the unique candidate at both inclusive date boundaries', () => {
    const candidates = [microcycle('week_1', '2026-09-21', '2026-09-27')]
    assert.deepEqual(resolveSessionMicrocycle('group_a', '2026-09-21', candidates), {
      status: 'resolved',
      groupId: 'group_a',
      microcycleId: 'week_1',
    })
    assert.deepEqual(resolveSessionMicrocycle('group_a', '2026-09-27', candidates), {
      status: 'resolved',
      groupId: 'group_a',
      microcycleId: 'week_1',
    })
  })

  it('returns unavailable when no microcycle contains the date', () => {
    const candidates = [microcycle('week_1', '2026-09-21', '2026-09-27')]
    assert.deepEqual(resolveSessionMicrocycle('group_a', '2026-09-28', candidates), {
      status: 'unavailable',
      groupId: 'group_a',
    })
    assert.deepEqual(resolveSessionMicrocycle('group_a', '2026-09-20', candidates), {
      status: 'unavailable',
      groupId: 'group_a',
    })
  })

  it('reports every overlapping candidate without choosing by input order', () => {
    const first = microcycle('week_1', '2026-09-21', '2026-09-27')
    const second = microcycle('week_2', '2026-09-25', '2026-10-01')
    const expected = {
      status: 'ambiguous',
      groupId: 'group_a',
      microcycleIds: ['week_1', 'week_2'],
    }
    assert.deepEqual(resolveSessionMicrocycle('group_a', '2026-09-26', [first, second]), expected)
    assert.deepEqual(resolveSessionMicrocycle('group_a', '2026-09-26', [second, first]), expected)
  })

  it('resolves each group only from its own candidate set', () => {
    const date = '2026-09-23'
    assert.deepEqual(resolveSessionMicrocycle('group_a', date, [
      microcycle('week_a', '2026-09-21', '2026-09-27'),
    ]), { status: 'resolved', groupId: 'group_a', microcycleId: 'week_a' })
    assert.deepEqual(resolveSessionMicrocycle('group_b', date, []), {
      status: 'unavailable',
      groupId: 'group_b',
    })
  })
})
