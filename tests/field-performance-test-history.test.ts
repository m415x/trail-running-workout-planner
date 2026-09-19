import assert from 'node:assert/strict'
import test from 'node:test'

import {
  appendFieldPerformanceTest,
  invalidateFieldPerformanceTest,
  listFieldPerformanceTestHistory,
  type FieldPerformanceTestRow,
} from '@/lib/physiology/field-performance-test-history'

function row(
  id: string,
  athleteId: string,
  performedAt: string,
  elapsedTimeSec: number,
): FieldPerformanceTestRow {
  return {
    id,
    athleteId,
    performedAt,
    protocol: '1000m_track',
    source: 'coach_manual',
    distanceM: 1000,
    elapsedTimeSec,
    notes: null,
    isDeleted: false,
    createdAt: `${performedAt}T12:00:00.000Z`,
    updatedAt: `${performedAt}T12:00:00.000Z`,
  }
}

test('append preserves repeated evaluations instead of overwriting by athlete/date', () => {
  const first = row('eval_1', 'athlete_1', '2026-08-27', 305)
  const second = row('eval_2', 'athlete_1', '2026-09-17', 298)

  const history = appendFieldPerformanceTest(
    appendFieldPerformanceTest([], first),
    second,
  )

  assert.deepEqual(history.map((evaluation) => evaluation.id), ['eval_1', 'eval_2'])
})

test('history is athlete-scoped, chronological, and excludes invalidated evidence by default', () => {
  const rows = [
    row('other', 'athlete_2', '2026-09-18', 280),
    row('new', 'athlete_1', '2026-09-17', 298),
    { ...row('invalid', 'athlete_1', '2026-09-01', 301), isDeleted: true },
    row('old', 'athlete_1', '2026-08-27', 305),
  ]

  assert.deepEqual(
    listFieldPerformanceTestHistory(rows, 'athlete_1').map((evaluation) => evaluation.id),
    ['old', 'new'],
  )
})

test('invalidation preserves the original row and changes only lifecycle metadata', () => {
  const original = row('eval_1', 'athlete_1', '2026-09-17', 298)

  const invalidated = invalidateFieldPerformanceTest(
    original,
    '2026-09-19T15:00:00.000Z',
  )

  assert.notEqual(invalidated, original)
  assert.equal(original.isDeleted, false)
  assert.deepEqual(invalidated, {
    ...original,
    isDeleted: true,
    updatedAt: '2026-09-19T15:00:00.000Z',
  })
})

test('correction is represented as invalidation plus a new appended evaluation', () => {
  const original = row('eval_1', 'athlete_1', '2026-09-17', 298)
  const corrected = row('eval_2', 'athlete_1', '2026-09-17', 296.5)

  const invalidated = invalidateFieldPerformanceTest(
    original,
    '2026-09-19T15:00:00.000Z',
  )
  const history = appendFieldPerformanceTest([invalidated], corrected)

  assert.equal(history.length, 2)
  assert.equal(history[0]?.isDeleted, true)
  assert.equal(history[0]?.elapsedTimeSec, 298)
  assert.equal(history[1]?.isDeleted, false)
  assert.equal(history[1]?.elapsedTimeSec, 296.5)
})
