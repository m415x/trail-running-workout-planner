import assert from 'node:assert/strict'
import test from 'node:test'

import {
  resolveRunningReference,
  type RunningReferenceEvidence,
} from '@/lib/physiology/running-reference'

const evidence = (
  overrides: Partial<RunningReferenceEvidence> = {},
): RunningReferenceEvidence => ({
  evaluationId: 'eval_1',
  performedAt: '2026-09-17',
  createdAt: '2026-09-17T12:00:00.000Z',
  protocol: '1000m_track',
  distanceM: 1000,
  elapsedTimeSec: 300,
  ...overrides,
})

test('returns explicit unknown when no evidence is eligible', () => {
  assert.deepEqual(
    resolveRunningReference({
      effectiveDate: '2026-09-16',
      evidence: [evidence()],
    }),
    { status: 'unknown' },
  )
})

test('resolves the latest evidence whose performedAt is not after effectiveDate', () => {
  const result = resolveRunningReference({
    effectiveDate: '2026-09-20',
    evidence: [
      evidence({ evaluationId: 'older', performedAt: '2026-09-10', elapsedTimeSec: 310 }),
      evidence({ evaluationId: 'eligible', performedAt: '2026-09-20', elapsedTimeSec: 300 }),
      evidence({ evaluationId: 'future', performedAt: '2026-09-21', elapsedTimeSec: 290 }),
    ],
  })

  assert.deepEqual(result, {
    status: 'available',
    source: {
      evaluationId: 'eligible',
      protocol: '1000m_track',
      performedAt: '2026-09-20',
      distanceM: 1000,
      elapsedTimeSec: 300,
    },
    derived: {
      paceSecPerKm: 300,
      paceLabel: '5:00/km',
      averageSpeedKmh: 12,
    },
  })
})

test('does not let later evidence change an earlier effective-date reference', () => {
  const items = [
    evidence({ evaluationId: 'historical', performedAt: '2026-09-17', elapsedTimeSec: 300 }),
    evidence({ evaluationId: 'later', performedAt: '2026-10-01', elapsedTimeSec: 285 }),
  ]

  assert.equal(
    resolveRunningReference({ effectiveDate: '2026-09-30', evidence: items }).status,
    'available',
  )

  const result = resolveRunningReference({ effectiveDate: '2026-09-30', evidence: items })
  assert.equal(result.status === 'available' ? result.source.evaluationId : null, 'historical')
})

test('breaks same-day ties deterministically by createdAt then evaluationId', () => {
  const result = resolveRunningReference({
    effectiveDate: '2026-09-17',
    evidence: [
      evidence({ evaluationId: 'eval_a', createdAt: '2026-09-17T12:00:00.000Z', elapsedTimeSec: 305 }),
      evidence({ evaluationId: 'eval_b', createdAt: '2026-09-17T13:00:00.000Z', elapsedTimeSec: 300 }),
      evidence({ evaluationId: 'eval_c', createdAt: '2026-09-17T13:00:00.000Z', elapsedTimeSec: 295 }),
    ],
  })

  assert.equal(result.status === 'available' ? result.source.evaluationId : null, 'eval_c')
})
