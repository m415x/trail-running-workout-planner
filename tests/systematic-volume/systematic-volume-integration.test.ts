import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildAthleteSystematicVolumeAssessment } from '@/lib/systematic-volume/systematic-volume-assessment'
import { buildSystematicVolumeCompactSummary } from '@/lib/systematic-volume/systematic-volume-presentation'
import { buildSystematicVolumeSeries } from '@/lib/systematic-volume/systematic-volume-series'
import type {
  AthletePlanRealComparison,
  Microcycle,
  PlanRealMetricComparison,
  PlannedSessionComparison,
  SystematicVolumeDimension,
  UnplannedRealizedComparison,
} from '@/types'

const dimensions: readonly SystematicVolumeDimension[] = ['distanceKm', 'durationMin', 'elevationGainM']
const units = { distanceKm: 'km', durationMin: 'min', elevationGainM: 'm' } as const

function metric(
  name: SystematicVolumeDimension,
  planned: number | null,
  realized: number | null,
): PlanRealMetricComparison {
  const unit = units[name]
  if (planned === null || realized === null) {
    return {
      name,
      evaluation: {
        state: 'not_evaluated',
        planned: planned === null
          ? { state: 'unknown', reason: 'not_prescribed', unit: null }
          : { state: 'known', value: planned, unit },
        realized: realized === null
          ? { state: 'unknown', reason: 'not_observed', unit: null }
          : { state: 'known', value: realized, unit },
        absoluteDelta: null,
        relativeDeltaPercent: null,
        reason: planned === null ? 'not_prescribed' : 'not_observed',
      },
    }
  }

  const delta = realized - planned
  return {
    name,
    evaluation: {
      state: delta === 0 ? 'matched' : 'deviation',
      planned: { state: 'known', value: planned, unit },
      realized: { state: 'known', value: realized, unit },
      absoluteDelta: delta,
      relativeDeltaPercent: planned > 0 ? (delta / planned) * 100 : null,
    },
  }
}

function planned(
  id: string,
  date: string,
  values: Record<SystematicVolumeDimension, readonly [number | null, number | null]>,
): PlannedSessionComparison {
  return {
    kind: 'planned_session',
    state: 'deviation',
    teamId: 'team-1',
    athleteId: 'athlete-1',
    date,
    sessionId: id,
    sessionTitle: id,
    planning: { source: 'group', teamId: 'team-1', groupId: 'group-1', planId: 'plan-1', cohortId: null },
    realized: { recordId: `realized-${id}`, provenance: 'manual', quality: 'complete', limitations: [] },
    metrics: dimensions.map(name => metric(name, ...values[name])),
    limitations: [],
  }
}

function unplanned(
  id: string,
  date: string,
  values: Record<SystematicVolumeDimension, number>,
): UnplannedRealizedComparison {
  return {
    kind: 'unplanned_realized',
    state: 'unplanned_realized',
    teamId: 'team-1',
    athleteId: 'athlete-1',
    date,
    realized: { recordId: id, provenance: 'manual', quality: 'complete', limitations: [] },
    metrics: dimensions.map(name => ({
      name,
      evaluation: {
        state: 'not_evaluated',
        planned: { state: 'unknown', reason: 'no_authoritative_session_link', unit: null },
        realized: { state: 'known', value: values[name], unit: units[name] },
        absoluteDelta: null,
        relativeDeltaPercent: null,
        reason: 'no_authoritative_session_link',
      },
    })),
    limitations: ['no_authoritative_session_link'],
  }
}

function microcycle(id: string, startDate: string, endDate: string, type: Microcycle['type'] = 'base'): Microcycle {
  return {
    id,
    createdAt: new Date(`${startDate}T00:00:00Z`),
    updatedAt: new Date(`${startDate}T00:00:00Z`),
    mesocycleId: 'meso-1',
    weekNumber: Number(id.split('-').at(-1) ?? 1),
    type,
    loadFocus: type === 'tapering' ? 'recovery' : 'volume',
    startDate,
    endDate,
    targetVolumeSource: 'generated',
    targetElevationSource: 'generated',
  }
}

describe('systematic volume integration', () => {
  it('flows plan-real plus unplanned volume into longitudinal assessment and compact summary', () => {
    const comparison: AthletePlanRealComparison = {
      teamId: 'team-1', athleteId: 'athlete-1',
      window: { kind: 'month', startDate: '2026-09-01', endDate: '2026-09-14' },
      planningLimitations: [],
      items: [
        planned('session-1', '2026-09-02', { distanceKm: [10, 11], durationMin: [60, 60], elevationGainM: [500, 500] }),
        unplanned('free-1', '2026-09-04', { distanceKm: 2, durationMin: 15, elevationGainM: 100 }),
        planned('session-2', '2026-09-09', { distanceKm: [10, 12], durationMin: [60, 65], elevationGainM: [500, 550] }),
      ],
    }
    const microcycles = [
      microcycle('mc-1', '2026-09-01', '2026-09-07'),
      microcycle('mc-2', '2026-09-08', '2026-09-14'),
    ]

    const series = buildSystematicVolumeSeries(comparison, microcycles)
    const assessment = buildAthleteSystematicVolumeAssessment('athlete-1', series)
    const summary = buildSystematicVolumeCompactSummary(assessment)

    const firstDistance = series.find(item => item.microcycleId === 'mc-1' && item.dimension === 'distanceKm')!
    assert.equal(firstDistance.magnitude?.planned, 10)
    assert.equal(firstDistance.magnitude?.realized, 13)
    assert.equal(firstDistance.coverage.unplannedRealizedSessions, 1)
    assert.deepEqual(firstDistance.unplannedRealizedSessionIds, ['free-1'])
    assert.equal(assessment.signals.distanceKm.pattern, 'systematic_excess')
    assert.equal(summary.code, 'review')
    assert.equal(summary.dimension, 'distanceKm')
  })

  it('preserves unknown as insufficient evidence instead of treating it as zero', () => {
    const comparison: AthletePlanRealComparison = {
      teamId: 'team-1', athleteId: 'athlete-1',
      window: { kind: 'week', startDate: '2026-09-01', endDate: '2026-09-07' },
      planningLimitations: [],
      items: [planned('session-1', '2026-09-02', {
        distanceKm: [10, null], durationMin: [60, 60], elevationGainM: [500, 500],
      })],
    }

    const series = buildSystematicVolumeSeries(comparison, [microcycle('mc-1', '2026-09-01', '2026-09-07')])
    const assessment = buildAthleteSystematicVolumeAssessment('athlete-1', series)

    assert.equal(assessment.signals.distanceKm.pattern, 'insufficient_data')
    assert.equal(assessment.signals.distanceKm.current?.magnitude, null)
    assert.ok(assessment.signals.distanceKm.insufficientReasons.includes('missing_realized_value'))
  })

  it('keeps taper context explainable without changing the calculated delta', () => {
    const comparison: AthletePlanRealComparison = {
      teamId: 'team-1', athleteId: 'athlete-1',
      window: { kind: 'week', startDate: '2026-09-01', endDate: '2026-09-07' },
      planningLimitations: [],
      items: [planned('session-1', '2026-09-02', {
        distanceKm: [10, 12], durationMin: [60, 60], elevationGainM: [500, 500],
      })],
    }

    const series = buildSystematicVolumeSeries(comparison, [microcycle('mc-1', '2026-09-01', '2026-09-07', 'tapering')])
    const distance = series.find(item => item.dimension === 'distanceKm')!

    assert.equal(distance.context.microcycleType, 'tapering')
    assert.equal(distance.context.loadFocus, 'recovery')
    assert.equal(distance.magnitude?.absoluteDelta, 2)
    assert.equal(distance.magnitude?.relativeDeltaPercent, 20)
  })
})
