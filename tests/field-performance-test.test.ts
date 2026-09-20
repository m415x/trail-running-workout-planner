import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createTrack1000mEvaluation,
  deriveTrack1000mPerformance,
} from '@/lib/physiology/field-performance-test'

test('creates canonical observed evidence for a 1000 m track evaluation', () => {
  const evaluation = createTrack1000mEvaluation({
    athleteId: 'athlete_1',
    performedAt: '2026-09-17',
    elapsedTimeSec: 300,
    notes: 'Pista 400 m',
  })

  assert.deepEqual(evaluation, {
    athleteId: 'athlete_1',
    performedAt: '2026-09-17',
    protocol: '1000m_track',
    source: 'coach_manual',
    distanceM: 1000,
    elapsedTimeSec: 300,
    notes: 'Pista 400 m',
  })
})

test('derives pace and average speed deterministically without storing PAM semantics', () => {
  assert.deepEqual(
    deriveTrack1000mPerformance({
      protocol: '1000m_track',
      distanceM: 1000,
      elapsedTimeSec: 300,
    }),
    {
      paceSecPerKm: 300,
      paceLabel: '5:00/km',
      averageSpeedKmh: 12,
    },
  )
})

test('supports sub-second observed time while keeping deterministic derived values', () => {
  const result = deriveTrack1000mPerformance({
    protocol: '1000m_track',
    distanceM: 1000,
    elapsedTimeSec: 215.5,
  })

  assert.equal(result.paceSecPerKm, 215.5)
  assert.equal(result.paceLabel, '3:35.5/km')
  assert.equal(result.averageSpeedKmh, 16.71)
})

test('rejects non-positive or non-finite elapsed time', () => {
  for (const elapsedTimeSec of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () =>
        createTrack1000mEvaluation({
          athleteId: 'athlete_1',
          performedAt: '2026-09-17',
          elapsedTimeSec,
        }),
      /elapsedTimeSec/,
    )
  }
})

test('rejects invalid calendar dates instead of normalizing them', () => {
  assert.throws(
    () =>
      createTrack1000mEvaluation({
        athleteId: 'athlete_1',
        performedAt: '2026-02-30',
        elapsedTimeSec: 300,
      }),
    /performedAt/,
  )
})

test('rejects missing athlete identity', () => {
  assert.throws(
    () =>
      createTrack1000mEvaluation({
        athleteId: '   ',
        performedAt: '2026-09-17',
        elapsedTimeSec: 300,
      }),
    /athleteId/,
  )
})

test('derivation refuses a different distance or protocol', () => {
  assert.throws(
    () =>
      deriveTrack1000mPerformance({
        protocol: '1000m_track',
        distanceM: 500,
        elapsedTimeSec: 150,
      }),
    /distanceM/,
  )

  assert.throws(
    () =>
      deriveTrack1000mPerformance({
        protocol: 'cooper' as '1000m_track',
        distanceM: 1000,
        elapsedTimeSec: 300,
      }),
    /protocol/,
  )
})


test('preserves official instance, execution context, recorder and review eligibility as independent evidence dimensions', () => {
  const evaluation = createTrack1000mEvaluation({
    athleteId: 'athlete_1',
    performedAt: '2026-09-24',
    elapsedTimeSec: 298,
    testEventId: 'event_2026_09',
    executionContext: 'official',
    recordedBy: 'athlete',
  })

  assert.equal(evaluation.testEventId, 'event_2026_09')
  assert.equal(evaluation.executionContext, 'official')
  assert.equal(evaluation.recordedBy, 'athlete')
  assert.equal(evaluation.reviewStatus, 'accepted')
  assert.equal(evaluation.isEligible, true)
})

test('self-directed evidence remains self-directed while awaiting coach review', () => {
  const evaluation = createTrack1000mEvaluation({
    athleteId: 'athlete_1',
    performedAt: '2026-09-19',
    elapsedTimeSec: 301,
    executionContext: 'self_directed',
    recordedBy: 'athlete',
  })

  assert.equal(evaluation.testEventId, null)
  assert.equal(evaluation.executionContext, 'self_directed')
  assert.equal(evaluation.recordedBy, 'athlete')
  assert.equal(evaluation.reviewStatus, 'pending_review')
  assert.equal(evaluation.isEligible, false)
})
