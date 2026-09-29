import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  applyAthleteAssignmentAdjustment,
} from '@/lib/planning-cohorts/athlete-assignment-adjustment'
import {
  resolveAthletePlannedSession,
  type EffectiveAudiencePrescription,
  type SharedSessionEvent,
} from '@/lib/planning-cohorts/athlete-session-adjustment'
import type {
  PersistedAthleteSessionAdjustment,
  PersistedAthleteSessionAdjustmentRevision,
} from '@/lib/planning-cohorts/athlete-session-adjustment-persistence'

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
  notes: 'Shared note',
}

function persistence() {
  const adjustments: PersistedAthleteSessionAdjustment[] = []
  const revisions: PersistedAthleteSessionAdjustmentRevision[] = []
  return {
    adjustments,
    revisions,
    adapter: {
      applyRevision: async (input: {
        adjustment: PersistedAthleteSessionAdjustment
        revision: PersistedAthleteSessionAdjustmentRevision
      }) => {
        const existing = adjustments.find(item =>
          item.athleteId === input.adjustment.athleteId
          && item.sourcePrescriptionId === input.adjustment.sourcePrescriptionId
        )
        if (!existing) adjustments.push(input.adjustment)
        revisions.forEach(revision => {
          if (revision.adjustmentId === input.adjustment.id && revision.isCurrent) {
            revision.isCurrent = false
          }
        })
        revisions.push(input.revision)
        return {
          adjustment: existing ?? input.adjustment,
          currentRevision: input.revision,
        }
      },
    },
  }
}

test('rescheduling changes only the Athlete planned date and keeps the shared Session unchanged', async () => {
  const store = persistence()
  const originalSession = structuredClone(session)

  const result = await applyAthleteAssignmentAdjustment({
    teamId: 'team-1',
    athleteId: 'athlete-1',
    sourcePrescription: prescription,
    adjustmentId: 'adjustment-1',
    revisionId: 'revision-1',
    reason: 'Availability conflict',
    changedByUserId: 'coach-1',
    assignment: {
      kind: 'rescheduled',
      date: '2026-10-07',
    },
    persistence: store.adapter,
  })

  assert.deepEqual(session, originalSession)
  assert.equal(result.currentRevision.payload.dose, null)

  const effective = resolveAthletePlannedSession({
    athleteId: 'athlete-1',
    session,
    prescription,
    adjustment: {
      id: result.adjustment.id,
      athleteId: result.adjustment.athleteId,
      sourcePrescriptionId: result.adjustment.sourcePrescriptionId,
      dose: result.currentRevision.payload.dose,
      assignment: result.currentRevision.payload.assignment,
    },
  })

  assert.equal(effective.status, 'resolved')
  assert.equal(effective.session.date, '2026-10-07')
  assert.equal(effective.session.workoutId, 'workout-trail')
  assert.deepEqual(session, originalSession)
})

test('stimulus replacement changes only workout/type for the Athlete', async () => {
  const store = persistence()

  const result = await applyAthleteAssignmentAdjustment({
    teamId: 'team-1',
    athleteId: 'athlete-1',
    sourcePrescription: prescription,
    adjustmentId: 'adjustment-1',
    revisionId: 'revision-1',
    reason: 'Replace stimulus',
    changedByUserId: 'coach-1',
    assignment: {
      kind: 'stimulus_override',
      workoutId: 'workout-recovery',
      type: 'Rest',
    },
    persistence: store.adapter,
  })

  const effective = resolveAthletePlannedSession({
    athleteId: 'athlete-1',
    session,
    prescription,
    adjustment: {
      id: result.adjustment.id,
      athleteId: result.adjustment.athleteId,
      sourcePrescriptionId: result.adjustment.sourcePrescriptionId,
      dose: null,
      assignment: result.currentRevision.payload.assignment,
    },
  })

  assert.equal(effective.status, 'resolved')
  assert.equal(effective.session.date, '2026-10-06')
  assert.equal(effective.session.workoutId, 'workout-recovery')
  assert.equal(effective.session.type, 'Rest')
  assert.equal(session.workoutId, 'workout-trail')
  assert.equal(session.type, 'Trail')
})

test('omission explicitly removes the Athlete planned stimulus without deleting the shared event', async () => {
  const store = persistence()

  const result = await applyAthleteAssignmentAdjustment({
    teamId: 'team-1',
    athleteId: 'athlete-1',
    sourcePrescription: prescription,
    adjustmentId: 'adjustment-1',
    revisionId: 'revision-1',
    reason: 'Skip stimulus',
    changedByUserId: 'coach-1',
    assignment: { kind: 'omitted' },
    persistence: store.adapter,
  })

  const effective = resolveAthletePlannedSession({
    athleteId: 'athlete-1',
    session,
    prescription,
    adjustment: {
      id: result.adjustment.id,
      athleteId: result.adjustment.athleteId,
      sourcePrescriptionId: result.adjustment.sourcePrescriptionId,
      dose: null,
      assignment: result.currentRevision.payload.assignment,
    },
  })

  assert.deepEqual(effective, {
    status: 'omitted',
    adjustmentId: 'adjustment-1',
    sourcePrescriptionId: 'prescription-1',
  })
  assert.equal(session.id, 'session-1')
})

test('assignment adjustment affects no sibling Athlete', async () => {
  const store = persistence()

  const result = await applyAthleteAssignmentAdjustment({
    teamId: 'team-1',
    athleteId: 'athlete-1',
    sourcePrescription: prescription,
    adjustmentId: 'adjustment-1',
    revisionId: 'revision-1',
    reason: 'Move only athlete one',
    changedByUserId: 'coach-1',
    assignment: {
      kind: 'rescheduled',
      date: '2026-10-08',
    },
    persistence: store.adapter,
  })

  const athleteOne = resolveAthletePlannedSession({
    athleteId: 'athlete-1',
    session,
    prescription,
    adjustment: {
      id: result.adjustment.id,
      athleteId: 'athlete-1',
      sourcePrescriptionId: 'prescription-1',
      dose: null,
      assignment: result.currentRevision.payload.assignment,
    },
  })

  const athleteTwo = resolveAthletePlannedSession({
    athleteId: 'athlete-2',
    session,
    prescription,
    adjustment: null,
  })

  assert.equal(athleteOne.status, 'resolved')
  assert.equal(athleteOne.session.date, '2026-10-08')
  assert.equal(athleteTwo.status, 'resolved')
  assert.equal(athleteTwo.session.date, '2026-10-06')
})
