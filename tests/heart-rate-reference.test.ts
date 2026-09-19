import assert from 'node:assert/strict'
import test from 'node:test'

import {
  HEART_RATE_REFERENCE_POLICY,
  resolveHeartRateReference,
} from '@/lib/physiology/heart-rate-reference'

test('prefers valid known heart-rate evidence over an age-predicted estimate', () => {
  const result = resolveHeartRateReference({
    effectiveDate: '2026-09-19',
    birthday: '1980-10-01',
    known: {
      maxHr: 184,
      restHr: 48,
      source: 'coach_record',
      observedAt: '2026-09-01',
    },
  })

  assert.deepEqual(result, {
    status: 'available',
    policyVersion: HEART_RATE_REFERENCE_POLICY.version,
    maxHr: {
      bpm: 184,
      provenance: {
        kind: 'known',
        source: 'coach_record',
        observedAt: '2026-09-01',
      },
    },
    restHr: {
      status: 'available',
      bpm: 48,
      provenance: {
        kind: 'known',
        source: 'coach_record',
        observedAt: '2026-09-01',
      },
    },
  })
})

test('uses Tanaka age-predicted max HR at the effective date when known max HR is absent', () => {
  const result = resolveHeartRateReference({
    effectiveDate: '2026-09-19',
    birthday: '1980-10-01',
  })

  assert.equal(result.status, 'available')
  if (result.status !== 'available') return

  assert.deepEqual(result.maxHr, {
    bpm: 176.5,
    provenance: {
      kind: 'age_predicted',
      formula: 'tanaka_2001',
      formulaVersion: '208 - 0.7 × age',
      ageYears: 45,
      birthday: '1980-10-01',
      effectiveDate: '2026-09-19',
    },
  })
})

test('never invents resting HR from birthday or a default', () => {
  const result = resolveHeartRateReference({
    effectiveDate: '2026-09-19',
    birthday: '1980-10-01',
  })

  assert.equal(result.status, 'available')
  if (result.status !== 'available') return

  assert.deepEqual(result.restHr, { status: 'unknown' })
})

test('returns explicit unknown when neither known max HR nor a valid birthday is available', () => {
  assert.deepEqual(
    resolveHeartRateReference({
      effectiveDate: '2026-09-19',
      birthday: null,
    }),
    {
      status: 'unknown',
      policyVersion: HEART_RATE_REFERENCE_POLICY.version,
    },
  )
})
