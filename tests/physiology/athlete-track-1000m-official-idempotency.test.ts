import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAthleteTrack1000mEvidence } from '../../lib/physiology/field-performance-test-application'
import type { FieldPerformanceTestRow } from '../../lib/physiology/field-performance-test-history'

describe('athlete official 1000m evidence idempotency', () => {
  it('rejects a second active official result for the same athlete and test event', async () => {
    let insertCount = 0
    const existing: FieldPerformanceTestRow = {
      id: 'evidence-1',
      athleteId: 'athlete-1',
      performedAt: '2026-09-24',
      protocol: '1000m_track',
      source: 'athlete_manual',
      testEventId: 'event-1',
      executionContext: 'official',
      recordedBy: 'athlete',
      recordedByUserId: 'user-1',
      reviewStatus: 'accepted',
      distanceM: 1000,
      elapsedTimeSec: 300,
      notes: null,
      isDeleted: false,
      createdAt: '2026-09-24T12:00:00.000Z',
      updatedAt: '2026-09-24T12:00:00.000Z',
    }

    const result = await createAthleteTrack1000mEvidence(
      {
        athleteId: 'athlete-1',
        userId: 'user-1',
        performedAt: '2026-09-24',
        elapsedTimeSec: 300,
        executionContext: 'official',
        testEventId: 'event-1',
      },
      {
        resolveSelfAthlete: async () => ({ id: 'athlete-1' }),
        resolveEligibleTestEvent: async () => ({ id: 'event-1' }),
        findActiveOfficialByAthleteAndTestEvent: () => existing,
        insert: evidence => {
          insertCount += 1
          return { ...evidence, isDeleted: false }
        },
        newId: () => 'evidence-2',
        now: () => '2026-09-24T12:00:00.000Z',
      },
    )

    assert.deepEqual(result, { success: false, error: 'official_evidence_already_exists' })
    assert.equal(insertCount, 0)
  })
})
