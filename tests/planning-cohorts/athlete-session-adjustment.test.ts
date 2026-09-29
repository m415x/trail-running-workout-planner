import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  resolveAthletePlannedSession,
  type AthleteSessionAdjustment,
  type EffectiveAudiencePrescription,
  type SharedSessionEvent,
} from '@/lib/planning-cohorts/athlete-session-adjustment'

const session: SharedSessionEvent = {
  id: 'session-1',
  date: '2026-10-06',
  workoutId: 'workout-trail',
  type: 'Trail',
}

const prescription: EffectiveAudiencePrescription = {
  id: 'prescription-1',
  distanceKm: 12,
  durationMin: 95,
  elevationGain: 650,
  intensityMethod: 'hr_zone',
  zone: 'Z2',
  referencePercentage: null,
  notes: 'Priorizá el esfuerzo sobre el ritmo',
}

test('inherits the effective audience prescription when no individual adjustment exists', () => {
  const result = resolveAthletePlannedSession({
    athleteId: 'athlete-1',
    session,
    prescription,
    adjustment: null,
  })

  assert.equal(result.status, 'resolved')
  assert.deepEqual(result.session, session)
  assert.deepEqual(result.prescription, prescription)
  assert.equal(result.adjustmentId, null)
})

test('applies only explicit dose overrides and inherits every absent field', () => {
  const adjustment: AthleteSessionAdjustment = {
    id: 'adjustment-1',
    athleteId: 'athlete-1',
    sourcePrescriptionId: 'prescription-1',
    dose: {
      distanceKm: { kind: 'override', value: 9 },
      durationMin: { kind: 'inherit' },
      elevationGain: { kind: 'override', value: 400 },
      intensity: { kind: 'inherit' },
    },
    assignment: { kind: 'inherit' },
  }

  const result = resolveAthletePlannedSession({
    athleteId: 'athlete-1',
    session,
    prescription,
    adjustment,
  })

  assert.equal(result.status, 'resolved')
  assert.equal(result.prescription.distanceKm, 9)
  assert.equal(result.prescription.durationMin, 95)
  assert.equal(result.prescription.elevationGain, 400)
  assert.equal(result.prescription.zone, 'Z2')
  assert.equal(result.prescription.notes, 'Priorizá el esfuerzo sobre el ritmo')
})

test('distinguishes reschedule, stimulus replacement and omission from inheritance', () => {
  const rescheduled = resolveAthletePlannedSession({
    athleteId: 'athlete-1',
    session,
    prescription,
    adjustment: {
      id: 'adjustment-reschedule',
      athleteId: 'athlete-1',
      sourcePrescriptionId: 'prescription-1',
      dose: null,
      assignment: { kind: 'rescheduled', date: '2026-10-07' },
    },
  })
  assert.equal(rescheduled.status, 'resolved')
  assert.equal(rescheduled.session.date, '2026-10-07')
  assert.equal(rescheduled.session.workoutId, 'workout-trail')

  const replaced = resolveAthletePlannedSession({
    athleteId: 'athlete-1',
    session,
    prescription,
    adjustment: {
      id: 'adjustment-stimulus',
      athleteId: 'athlete-1',
      sourcePrescriptionId: 'prescription-1',
      dose: null,
      assignment: { kind: 'stimulus_override', workoutId: 'workout-recovery', type: 'Rest' },
    },
  })
  assert.equal(replaced.status, 'resolved')
  assert.equal(replaced.session.date, '2026-10-06')
  assert.equal(replaced.session.workoutId, 'workout-recovery')
  assert.equal(replaced.session.type, 'Rest')

  const omitted = resolveAthletePlannedSession({
    athleteId: 'athlete-1',
    session,
    prescription,
    adjustment: {
      id: 'adjustment-omit',
      athleteId: 'athlete-1',
      sourcePrescriptionId: 'prescription-1',
      dose: null,
      assignment: { kind: 'omitted' },
    },
  })
  assert.deepEqual(omitted, {
    status: 'omitted',
    adjustmentId: 'adjustment-omit',
    sourcePrescriptionId: 'prescription-1',
  })
})

test('does not apply an adjustment owned by another athlete or source prescription', () => {
  const wrongAthlete = resolveAthletePlannedSession({
    athleteId: 'athlete-1',
    session,
    prescription,
    adjustment: {
      id: 'adjustment-2',
      athleteId: 'athlete-2',
      sourcePrescriptionId: 'prescription-1',
      dose: null,
      assignment: { kind: 'inherit' },
    },
  })

  assert.deepEqual(wrongAthlete, {
    status: 'outside_authority',
    reason: 'athlete-mismatch',
    adjustmentId: 'adjustment-2',
  })

  const wrongPrescription = resolveAthletePlannedSession({
    athleteId: 'athlete-1',
    session,
    prescription,
    adjustment: {
      id: 'adjustment-3',
      athleteId: 'athlete-1',
      sourcePrescriptionId: 'prescription-other',
      dose: null,
      assignment: { kind: 'inherit' },
    },
  })

  assert.deepEqual(wrongPrescription, {
    status: 'outside_authority',
    reason: 'source-prescription-mismatch',
    adjustmentId: 'adjustment-3',
  })
})


test('supports explicit removal of optional dose fields without conflating it with inherit', () => {
  const result = resolveAthletePlannedSession({
    athleteId: 'athlete-1',
    session,
    prescription,
    adjustment: {
      id: 'adjustment-clear',
      athleteId: 'athlete-1',
      sourcePrescriptionId: 'prescription-1',
      dose: {
        distanceKm: { kind: 'inherit' },
        durationMin: { kind: 'inherit' },
        elevationGain: { kind: 'inherit' },
        intensity: { kind: 'override', value: null },
      },
      assignment: { kind: 'inherit' },
    },
  })

  assert.equal(result.status, 'resolved')
  assert.equal(result.prescription.distanceKm, 12)
  assert.equal(result.prescription.intensityMethod, null)
  assert.equal(result.prescription.zone, null)
  assert.equal(result.prescription.referencePercentage, null)
  assert.equal(result.prescription.notes, null)
})

test('omission is authoritative and does not leak dose or assignment mutations into a resolved session', () => {
  const result = resolveAthletePlannedSession({
    athleteId: 'athlete-1',
    session,
    prescription,
    adjustment: {
      id: 'adjustment-omit-with-dose',
      athleteId: 'athlete-1',
      sourcePrescriptionId: 'prescription-1',
      dose: {
        distanceKm: { kind: 'override', value: 3 },
        durationMin: { kind: 'inherit' },
        elevationGain: { kind: 'inherit' },
        intensity: { kind: 'inherit' },
        },
      assignment: { kind: 'omitted' },
    },
  })

  assert.deepEqual(result, {
    status: 'omitted',
    adjustmentId: 'adjustment-omit-with-dose',
    sourcePrescriptionId: 'prescription-1',
  })
})
