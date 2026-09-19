import assert from 'node:assert/strict'
import test from 'node:test'

import type { PhysiologyRecord } from '@/types/athlete/physiology.types'
import { planLegacyPhysiologyReconciliation, promoteLegacy1000mEvidence } from '@/lib/physiology/legacy-field-performance'

function legacy(overrides: Partial<PhysiologyRecord> = {}): PhysiologyRecord {
  return {
    id: 'legacy_1',
    isDeleted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    athleteId: 'athlete_1',
    date: '2026-01-30',
    pamTimeSec: 300,
    pamPaceFormatted: '5:00/km',
    pamSpeedKmh: 12,
    maxHr: 190,
    restHr: 50,
    ...overrides,
  }
}

test('promotes only explicit 1000m_track legacy evidence', () => {
  assert.deepEqual(promoteLegacy1000mEvidence(legacy({ testType: '1000m_track' })), {
    id: 'legacy_1',
    athleteId: 'athlete_1',
    performedAt: '2026-01-30',
    protocol: '1000m_track',
    distanceM: 1000,
    elapsedTimeSec: 300,
    notes: null,
    isDeleted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })
})

test('does not reinterpret ambiguous or other legacy protocols as 1000m evidence', () => {
  assert.equal(promoteLegacy1000mEvidence(legacy({ testType: undefined })), null)
  assert.equal(promoteLegacy1000mEvidence(legacy({ testType: 'ramp_test' })), null)
  assert.equal(promoteLegacy1000mEvidence(legacy({ testType: 'cooper' })), null)
  assert.equal(promoteLegacy1000mEvidence(legacy({ testType: 'field_trial' })), null)
})

test('preserves lifecycle and notes but never promotes legacy HR or derived PAM fields', () => {
  const promoted = promoteLegacy1000mEvidence(legacy({
    testType: '1000m_track',
    notes: 'control mensual',
    isDeleted: true,
    maxHr: 201,
    restHr: 44,
    thresholdHr: 181,
    pamPaceFormatted: 'legacy derived value',
    pamSpeedKmh: 99,
  }))

  assert.equal(promoted?.notes, 'control mensual')
  assert.equal(promoted?.isDeleted, true)
  assert.equal('maxHr' in (promoted ?? {}), false)
  assert.equal('restHr' in (promoted ?? {}), false)
  assert.equal('thresholdHr' in (promoted ?? {}), false)
  assert.equal('pamPaceFormatted' in (promoted ?? {}), false)
  assert.equal('pamSpeedKmh' in (promoted ?? {}), false)
})


test('does not promote explicit 1000m legacy rows with invalid observed facts', () => {
  assert.equal(promoteLegacy1000mEvidence(legacy({ testType: '1000m_track', pamTimeSec: 0 })), null)
  assert.equal(promoteLegacy1000mEvidence(legacy({ testType: '1000m_track', pamTimeSec: -1 })), null)
  assert.equal(promoteLegacy1000mEvidence(legacy({ testType: '1000m_track', pamTimeSec: Number.NaN })), null)
  assert.equal(promoteLegacy1000mEvidence(legacy({ testType: '1000m_track', date: '2026-02-30' })), null)
  assert.equal(promoteLegacy1000mEvidence(legacy({ testType: '1000m_track', athleteId: '   ' })), null)
})


test('reconciliation plan promotes safe evidence without dropping legacy source rows', () => {
  const explicit = legacy({ id: 'explicit', testType: '1000m_track' })
  const ambiguous = legacy({ id: 'ambiguous', testType: undefined })
  const otherProtocol = legacy({ id: 'cooper', testType: 'cooper' })
  const invalid = legacy({ id: 'invalid', testType: '1000m_track', pamTimeSec: 0 })

  const plan = planLegacyPhysiologyReconciliation([
    explicit,
    ambiguous,
    otherProtocol,
    invalid,
  ])

  assert.deepEqual(plan.promoted.map(row => row.id), ['explicit'])
  assert.deepEqual(plan.retainedLegacy.map(row => row.id), [
    'explicit',
    'ambiguous',
    'cooper',
    'invalid',
  ])
})
