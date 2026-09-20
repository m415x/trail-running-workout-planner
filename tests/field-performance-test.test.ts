import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createTrack1000mEvaluation,
  deriveTrack1000mPerformance,
  reviewTrack1000mEvaluation,
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
    testEventId: null,
    executionContext: 'official',
    recordedBy: 'coach',
    recordedByUserId: null,
    reviewStatus: 'accepted',
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
  assert.equal(evaluation.reviewStatus, 'accepted')
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
  assert.equal(evaluation.reviewStatus, 'pending_review')
})


test('preserves durable recorder identity independently from execution context and recorder role', () => {
  const evaluation = createTrack1000mEvaluation({
    athleteId: 'athlete_1',
    performedAt: '2026-09-24',
    elapsedTimeSec: 298,
    testEventId: 'event_2026_09',
    executionContext: 'official',
    recordedBy: 'coach',
    recordedByUserId: 'user_coach_1',
  })

  assert.equal(evaluation.recordedBy, 'coach')
  assert.equal(evaluation.recordedByUserId, 'user_coach_1')
})


test('review lifecycle accepts or rejects pending self-directed evidence without changing provenance', () => {
  const pending = createTrack1000mEvaluation({
    athleteId: 'athlete_1',
    performedAt: '2026-09-19',
    elapsedTimeSec: 301,
    executionContext: 'self_directed',
    recordedBy: 'athlete',
    recordedByUserId: 'user_athlete_1',
  })

  for (const reviewStatus of ['accepted', 'rejected'] as const) {
    const reviewed = reviewTrack1000mEvaluation(pending, reviewStatus)

    assert.equal(reviewed.reviewStatus, reviewStatus)
    assert.equal(reviewed.executionContext, 'self_directed')
    assert.equal(reviewed.testEventId, null)
    assert.equal(reviewed.source, 'athlete_manual')
    assert.equal(reviewed.recordedBy, 'athlete')
    assert.equal(reviewed.recordedByUserId, 'user_athlete_1')
    assert.equal(reviewed.elapsedTimeSec, 301)
  }
})

test('review lifecycle refuses terminal evidence transitions', () => {
  const pending = createTrack1000mEvaluation({
    athleteId: 'athlete_1',
    performedAt: '2026-09-19',
    elapsedTimeSec: 301,
    executionContext: 'self_directed',
    recordedBy: 'athlete',
  })

  const accepted = reviewTrack1000mEvaluation(pending, 'accepted')
  const rejected = reviewTrack1000mEvaluation(pending, 'rejected')

  assert.throws(() => reviewTrack1000mEvaluation(accepted, 'rejected'), /pending_review/)
  assert.throws(() => reviewTrack1000mEvaluation(rejected, 'accepted'), /pending_review/)
})
