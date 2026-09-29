import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  resolveEffectiveAthleteAdjustment,
} from '@/lib/planning-cohorts/athlete-adjustment-resolution'
import type {
  PersistedAthleteSessionAdjustment,
  PersistedAthleteSessionAdjustmentRevision,
} from '@/lib/planning-cohorts/athlete-session-adjustment-persistence'

const adjustment: PersistedAthleteSessionAdjustment = {
  id: 'adjustment-1',
  teamId: 'team-1',
  athleteId: 'athlete-1',
  sourcePrescriptionId: 'prescription-1',
}

const activeRevision: PersistedAthleteSessionAdjustmentRevision = {
  id: 'revision-2',
  adjustmentId: 'adjustment-1',
  state: 'active',
  payload: {
    dose: {
      distanceKm: { kind: 'override', value: 9 },
      durationMin: { kind: 'inherit' },
      elevationGain: { kind: 'inherit' },
      intensity: { kind: 'inherit' },
    },
    assignment: { kind: 'inherit' },
  },
  reason: 'Individual volume cap',
  changedByUserId: 'coach-1',
  isCurrent: true,
}

test('returns the current active adjustment only for the effective source prescription', () => {
  const result = resolveEffectiveAthleteAdjustment({
    athleteId: 'athlete-1',
    effectivePrescriptionId: 'prescription-1',
    adjustment,
    revisions: [
      { ...activeRevision, id: 'revision-1', isCurrent: false },
      activeRevision,
    ],
  })

  assert.equal(result.status, 'resolved')
  assert.equal(result.adjustment.id, 'adjustment-1')
  assert.equal(result.revision.id, 'revision-2')
})

test('withdrawn current revision means inherit from the effective audience prescription', () => {
  const result = resolveEffectiveAthleteAdjustment({
    athleteId: 'athlete-1',
    effectivePrescriptionId: 'prescription-1',
    adjustment,
    revisions: [{
      ...activeRevision,
      state: 'withdrawn',
      isCurrent: true,
    }],
  })

  assert.deepEqual(result, {
    status: 'none',
    reason: 'withdrawn',
  })
})

test('stale source prescription is never silently reapplied', () => {
  const result = resolveEffectiveAthleteAdjustment({
    athleteId: 'athlete-1',
    effectivePrescriptionId: 'prescription-new',
    adjustment,
    revisions: [activeRevision],
  })

  assert.deepEqual(result, {
    status: 'outside_authority',
    reason: 'source-prescription-mismatch',
    adjustmentId: 'adjustment-1',
  })
})

test('adjustment owned by another Athlete is outside authority', () => {
  const result = resolveEffectiveAthleteAdjustment({
    athleteId: 'athlete-1',
    effectivePrescriptionId: 'prescription-1',
    adjustment: {
      ...adjustment,
      athleteId: 'athlete-2',
    },
    revisions: [activeRevision],
  })

  assert.deepEqual(result, {
    status: 'outside_authority',
    reason: 'athlete-mismatch',
    adjustmentId: 'adjustment-1',
  })
})

test('multiple current revisions are a conflict, not last-write-wins', () => {
  const result = resolveEffectiveAthleteAdjustment({
    athleteId: 'athlete-1',
    effectivePrescriptionId: 'prescription-1',
    adjustment,
    revisions: [
      activeRevision,
      { ...activeRevision, id: 'revision-3' },
    ],
  })

  assert.deepEqual(result, {
    status: 'conflict',
    reason: 'multiple-current-revisions',
    adjustmentId: 'adjustment-1',
    revisionIds: ['revision-2', 'revision-3'],
  })
})
