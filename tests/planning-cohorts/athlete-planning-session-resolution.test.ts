import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  resolveAthletePlanningSession,
} from '@/lib/planning-cohorts/athlete-planning-session-resolution'
import type {
  PersistedAthleteSessionAdjustment,
  PersistedAthleteSessionAdjustmentRevision,
} from '@/lib/planning-cohorts/athlete-session-adjustment-persistence'

const session = {
  id: 'session-1',
  date: '2026-10-06',
  workoutId: 'workout-trail',
  type: 'Trail' as const,
}

const prescription = {
  id: 'prescription-1',
  distanceKm: 12,
  durationMin: 95,
  elevationGain: 650,
  intensityMethod: 'hr_zone' as const,
  zone: 'Z2' as const,
  referencePercentage: null,
  notes: 'Shared note',
}

const adjustment: PersistedAthleteSessionAdjustment = {
  id: 'adjustment-1',
  teamId: 'team-1',
  athleteId: 'athlete-1',
  sourcePrescriptionId: 'prescription-1',
}

function revision(
  overrides: Partial<PersistedAthleteSessionAdjustmentRevision> = {},
): PersistedAthleteSessionAdjustmentRevision {
  return {
    id: 'revision-1',
    adjustmentId: 'adjustment-1',
    state: 'active',
    payload: {
      dose: null,
      assignment: { kind: 'inherit' },
    },
    reason: 'Coach adjustment',
    changedByUserId: 'coach-1',
    isCurrent: true,
    ...overrides,
  }
}

test('without an adjustment it returns the audience prescription unchanged', () => {
  const result = resolveAthletePlanningSession({
    athleteId: 'athlete-1',
    session,
    prescription,
    adjustment: null,
    revisions: [],
  })

  assert.equal(result.status, 'resolved')
  assert.deepEqual(result.session, session)
  assert.deepEqual(result.prescription, prescription)
})

test('applies dose and reschedule from the current active revision', () => {
  const result = resolveAthletePlanningSession({
    athleteId: 'athlete-1',
    session,
    prescription,
    adjustment,
    revisions: [revision({
      payload: {
        dose: {
          distanceKm: { kind: 'override', value: 9 },
          durationMin: { kind: 'inherit' },
          elevationGain: { kind: 'inherit' },
          intensity: { kind: 'inherit' },
            },
        assignment: { kind: 'rescheduled', date: '2026-10-08' },
      },
    })],
  })

  assert.equal(result.status, 'resolved')
  assert.equal(result.session.date, '2026-10-08')
  assert.equal(result.prescription.distanceKm, 9)
  assert.equal(result.prescription.durationMin, 95)
})

test('applies stimulus replacement without mutating unrelated shared-event fields', () => {
  const result = resolveAthletePlanningSession({
    athleteId: 'athlete-1',
    session,
    prescription,
    adjustment,
    revisions: [revision({
      payload: {
        dose: null,
        assignment: {
          kind: 'stimulus_override',
          workoutId: 'workout-rest',
          type: 'Rest',
        },
      },
    })],
  })

  assert.equal(result.status, 'resolved')
  assert.equal(result.session.date, '2026-10-06')
  assert.equal(result.session.workoutId, 'workout-rest')
  assert.equal(result.session.type, 'Rest')
})

test('omission removes only the Athlete planned session', () => {
  const result = resolveAthletePlanningSession({
    athleteId: 'athlete-1',
    session,
    prescription,
    adjustment,
    revisions: [revision({
      payload: {
        dose: null,
        assignment: { kind: 'omitted' },
      },
    })],
  })

  assert.deepEqual(result, {
    status: 'omitted',
    adjustmentId: 'adjustment-1',
    sourcePrescriptionId: 'prescription-1',
  })
})

test('withdrawn adjustment falls back to inherited audience planning', () => {
  const result = resolveAthletePlanningSession({
    athleteId: 'athlete-1',
    session,
    prescription,
    adjustment,
    revisions: [revision({ state: 'withdrawn' })],
  })

  assert.equal(result.status, 'resolved')
  assert.deepEqual(result.session, session)
  assert.deepEqual(result.prescription, prescription)
})

test('stale source prescription is reported outside authority and never reapplied', () => {
  const result = resolveAthletePlanningSession({
    athleteId: 'athlete-1',
    session,
    prescription: { ...prescription, id: 'prescription-new' },
    adjustment,
    revisions: [revision()],
  })

  assert.deepEqual(result, {
    status: 'outside_authority',
    reason: 'source-prescription-mismatch',
    adjustmentId: 'adjustment-1',
  })
})
