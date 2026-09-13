import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  deduplicateRealizedTrainingRecords,
  hasAuthoritativeSessionLink,
  normalizeRealizedTrainingRecord,
} from '@/lib/readiness/realized-training'
import type { RawRealizedTrainingRecord } from '@/types'

function raw(
  overrides: Partial<RawRealizedTrainingRecord> = {},
): RawRealizedTrainingRecord {
  return {
    id: 'log-1',
    teamId: 'team-1',
    athleteId: 'athlete-1',
    sessionId: 'session-1',
    workoutId: 'workout-1',
    date: '2026-09-10',
    status: 'completed',
    distanceKm: 12,
    durationMin: 75,
    elevationGainM: 450,
    avgHrBpm: 148,
    rpe: 6,
    loggedAt: '2026-09-10T21:00:00.000Z',
    source: 'manual',
    sourceActivityId: null,
    knownMetricFields: ['distanceKm', 'durationMin', 'elevationGainM', 'avgHrBpm', 'rpe'],
    ...overrides,
  }
}

describe('realized training normalization', () => {
  it('preserva un cero explícitamente informado como valor conocido', () => {
    const record = normalizeRealizedTrainingRecord(raw({
      elevationGainM: 0,
      knownMetricFields: ['distanceKm', 'durationMin', 'elevationGainM', 'rpe'],
      avgHrBpm: null,
    }))

    assert.deepEqual(record.metrics.elevationGainM, { state: 'known', value: 0 })
    assert.equal(record.metrics.avgHrBpm.state, 'unknown')
    assert.equal(record.quality, 'partial')
  })

  it('no interpreta un cero legacy sin evidencia como entrenamiento medido', () => {
    const record = normalizeRealizedTrainingRecord(raw({
      distanceKm: 0,
      durationMin: 0,
      elevationGainM: 0,
      avgHrBpm: null,
      rpe: 0,
      knownMetricFields: null,
    }))

    assert.equal(record.metrics.distanceKm.state, 'unknown')
    assert.equal(record.metrics.durationMin.state, 'unknown')
    assert.equal(record.metrics.elevationGainM.state, 'unknown')
    assert.equal(record.metrics.rpe.state, 'unknown')
    assert.equal(record.quality, 'ambiguous')
    assert.ok(record.limitations.includes('legacy_record_without_metric_evidence'))
  })

  it('distingue missed explícito de ausencia de datos', () => {
    const record = normalizeRealizedTrainingRecord(raw({
      status: 'missed',
      distanceKm: null,
      durationMin: null,
      elevationGainM: null,
      avgHrBpm: null,
      rpe: null,
      knownMetricFields: [],
    }))

    assert.equal(record.quality, 'explicit_missed')
  })

  it('sólo habilita plan-vs-real con vínculo explícito a Session', () => {
    const linked = normalizeRealizedTrainingRecord(raw())
    const unlinked = normalizeRealizedTrainingRecord(raw({ sessionId: null }))

    assert.equal(hasAuthoritativeSessionLink(linked), true)
    assert.equal(hasAuthoritativeSessionLink(unlinked), false)
  })

  it('deduplica sólo por identidad persistida o sourceActivityId estable', () => {
    const first = normalizeRealizedTrainingRecord(raw({
      id: 'log-a',
      source: 'imported',
      sourceActivityId: 'external-1',
    }))
    const duplicateSource = normalizeRealizedTrainingRecord(raw({
      id: 'log-b',
      source: 'imported',
      sourceActivityId: 'external-1',
    }))
    const sameMetricsButDistinct = normalizeRealizedTrainingRecord(raw({
      id: 'log-c',
      source: 'manual',
      sourceActivityId: null,
    }))

    const result = deduplicateRealizedTrainingRecords([
      first,
      duplicateSource,
      sameMetricsButDistinct,
    ])

    assert.deepEqual(result.records.map(({ id }) => id), ['log-a', 'log-c'])
    assert.deepEqual(result.duplicateRecordIds, ['log-b'])
    assert.deepEqual(result.ambiguousRecordIds, [])
  })

  it('marca un importado sin identidad externa como ambiguo en vez de deduplicarlo por heurística', () => {
    const imported = normalizeRealizedTrainingRecord(raw({
      id: 'log-imported',
      source: 'imported',
      sourceActivityId: null,
    }))

    const result = deduplicateRealizedTrainingRecords([imported])

    assert.deepEqual(result.records.map(({ id }) => id), ['log-imported'])
    assert.deepEqual(result.ambiguousRecordIds, ['log-imported'])
  })
})
