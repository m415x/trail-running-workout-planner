import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateSessionMicrocyclePrescriptions } from '@/lib/sessions/session-microcycle-integration'

const week = (id: string, startDate: string, endDate: string) => ({ id, startDate, endDate })

describe('create/edit session microcycle integration', () => {
  it('accepts independent valid prescriptions for a shared session', () => {
    assert.equal(validateSessionMicrocyclePrescriptions('2026-09-23', [
      { groupId: 'a', microcycleId: 'a_1' },
      { groupId: 'b', microcycleId: 'b_1' },
    ], {
      a: [week('a_1', '2026-09-21', '2026-09-27')],
      b: [week('b_1', '2026-09-22', '2026-09-28')],
    }), null)
  })

  it('rejects the entire shared session when one group becomes invalid after an edit', () => {
    assert.deepEqual(validateSessionMicrocyclePrescriptions('2026-09-28', [
      { groupId: 'a', microcycleId: 'a_1' },
      { groupId: 'b', microcycleId: 'b_1' },
    ], {
      a: [week('a_1', '2026-09-21', '2026-09-27')],
      b: [week('b_1', '2026-09-28', '2026-10-04')],
    }), { errorCode: 'microcycleDateMismatch', errorParams: { group: 'a' } })
  })

  it('rejects overlapping weeks independently of submitted selection', () => {
    assert.deepEqual(validateSessionMicrocyclePrescriptions('2026-09-26', [
      { groupId: 'a', microcycleId: 'a_2' },
    ], {
      a: [week('a_1', '2026-09-21', '2026-09-27'), week('a_2', '2026-09-25', '2026-10-01')],
    }), { errorCode: 'microcycleDateAmbiguous', errorParams: { group: 'a' } })
  })
})
