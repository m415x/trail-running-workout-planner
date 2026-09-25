import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCoachTrack1000mEvidence } from '../../lib/physiology/field-performance-test-application'

describe('coach official 1000m evidence idempotency', () => {
  it('rejects a second active official result for the same athlete and test event', async () => {
    let insertCount = 0
    const existing = {
      id: 'evidence-1',
      athleteId: 'athlete-1',
      performedAt: '2026-09-24',
      protocol: '1000m_track' as const,
      source: 'coach_manual' as const,
      distanceM: 1000 as const,
      elapsedTimeSec: 300,
      testEventId: 'event-1',
      executionContext: 'official' as const,
      recordedBy: 'coach' as const,
      recordedByUserId: null,
      reviewStatus: 'accepted' as const,
      notes: null,
      isDeleted: false,
      createdAt: '2026-09-24T12:00:00.000Z',
      updatedAt: '2026-09-24T12:00:00.000Z',
    }

    const result = await createCoachTrack1000mEvidence(
      {
        athleteId: 'athlete-1',
        testEventId: 'event-1',
        performedAt: '2026-09-24',
        elapsedTimeSec: 300,
      },
      {
        resolveOwnedAthlete: async () => ({ id: 'athlete-1' }),
        resolveEligibleTestEvent: async () => ({ id: 'event-1' }),
        findActiveOfficialByAthleteAndTestEvent: () => existing,
        insert: evidence => {
          insertCount += 1
          return evidence as never
        },
        newId: () => 'evidence-2',
        now: () => '2026-09-24T12:00:00.000Z',
      },
    )

    assert.deepEqual(result, { success: false, error: 'official_evidence_already_exists' })
    assert.equal(insertCount, 0)
  })
})
