import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAthleteSelfPeriodRead } from '@/lib/athlete-planning/self-period-read'

const period = { startDate: '2026-10-05', endDate: '2026-10-18' }
const subject = { userId: 'user-1', teamId: 'team-1', athleteProfileId: 'athlete-1' }

describe('KAN-645/T1 — SELF effective period read boundary', () => {
  it('denies before invoking planning repositories when planning.self.read is not resolved', async () => {
    let reads = 0
    const read = createAthleteSelfPeriodRead({
      resolveSelf: async () => ({ status: 'denied' as const }),
      loadEffectivePeriod: async () => { reads++; return { status: 'empty' as const } },
    })

    assert.deepEqual(await read(period), { status: 'denied' })
    assert.equal(reads, 0)
  })

  it('uses exclusively server-resolved identity and scope for period reads', async () => {
    const seen: unknown[] = []
    const read = createAthleteSelfPeriodRead({
      resolveSelf: async () => ({ status: 'resolved' as const, subject }),
      loadEffectivePeriod: async (scope) => {
        seen.push(scope)
        return { status: 'loaded' as const, sessions: [] }
      },
    })

    const result = await read(period)
    assert.equal(result.status, 'loaded')
    assert.deepEqual(seen, [{ ...period, ...subject }])
  })

  it('never launders dated planning, prescription or adjustment conflicts into authorized empty', async () => {
    const read = createAthleteSelfPeriodRead({
      resolveSelf: async () => ({ status: 'resolved' as const, subject }),
      loadEffectivePeriod: async () => ({
        status: 'conflict' as const,
        reason: 'overlapping-cohorts' as const,
      }),
    })

    assert.deepEqual(await read(period), { status: 'error' })
  })

  it('keeps genuinely absent planning distinct from denied and inconsistent lineage', async () => {
    const read = createAthleteSelfPeriodRead({
      resolveSelf: async () => ({ status: 'resolved' as const, subject }),
      loadEffectivePeriod: async () => ({ status: 'empty' as const }),
    })

    assert.deepEqual(await read(period), { status: 'empty' })
  })
})
