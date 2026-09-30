import assert from 'node:assert/strict'
import { test } from 'node:test'

import { applyAthleteAssignmentAdjustment } from '@/lib/planning-cohorts/athlete-assignment-adjustment'
import { applyAthleteDoseAdjustment } from '@/lib/planning-cohorts/athlete-dose-adjustment'
import type {
  PersistedAthleteSessionAdjustment,
  PersistedAthleteSessionAdjustmentRevision,
} from '@/lib/planning-cohorts/athlete-session-adjustment-persistence'

const sourcePrescription = {
  id: 'prescription-1',
  distanceKm: 12,
  durationMin: 95,
  elevationGain: 650,
  intensityMethod: 'hr_zone' as const,
  zone: 'Z2' as const,
  referencePercentage: null,
  notes: 'Shared audience note',
}

const adjustment: PersistedAthleteSessionAdjustment = {
  id: 'adjustment-1',
  teamId: 'team-1',
  athleteId: 'athlete-1',
  sourcePrescriptionId: 'prescription-1',
}

function persistence(currentRevision: PersistedAthleteSessionAdjustmentRevision) {
  return {
    applyRevision: async (input: {
      adjustment: PersistedAthleteSessionAdjustment
      revision: PersistedAthleteSessionAdjustmentRevision
    }) => ({
      adjustment: input.adjustment,
      currentRevision: input.revision,
    }),
    getCurrentRevision: async () => currentRevision,
  }
}

test('editing dose preserves the current assignment delta', async () => {
  const currentRevision: PersistedAthleteSessionAdjustmentRevision = {
    id: 'revision-1',
    adjustmentId: adjustment.id,
    state: 'active',
    payload: {
      dose: null,
      assignment: { kind: 'rescheduled', date: '2026-10-08' },
    },
    reason: 'Reschedule',
    changedByUserId: 'coach-1',
    isCurrent: true,
  }

  const result = await applyAthleteDoseAdjustment({
    teamId: adjustment.teamId,
    athleteId: adjustment.athleteId,
    sourcePrescription,
    adjustmentId: adjustment.id,
    revisionId: 'revision-2',
    reason: 'Reduce distance',
    changedByUserId: 'coach-1',
    overrides: { distanceKm: 9 },
    persistence: persistence(currentRevision),
  })

  assert.deepEqual(result.currentRevision.payload.assignment, currentRevision.payload.assignment)
})

test('editing assignment preserves the current dose delta', async () => {
  const currentRevision: PersistedAthleteSessionAdjustmentRevision = {
    id: 'revision-1',
    adjustmentId: adjustment.id,
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
    reason: 'Reduce distance',
    changedByUserId: 'coach-1',
    isCurrent: true,
  }

  const result = await applyAthleteAssignmentAdjustment({
    teamId: adjustment.teamId,
    athleteId: adjustment.athleteId,
    sourcePrescription,
    adjustmentId: adjustment.id,
    revisionId: 'revision-2',
    reason: 'Now reschedule too',
    changedByUserId: 'coach-1',
    assignment: { kind: 'rescheduled', date: '2026-10-08' },
    persistence: persistence(currentRevision),
  })

  assert.deepEqual(result.currentRevision.payload.dose, currentRevision.payload.dose)
})

test('individual dose contract has no shared-note override', async () => {
  const currentRevision: PersistedAthleteSessionAdjustmentRevision = {
    id: 'revision-1',
    adjustmentId: adjustment.id,
    state: 'active',
    payload: {
      dose: null,
      assignment: { kind: 'inherit' },
    },
    reason: 'Initial',
    changedByUserId: 'coach-1',
    isCurrent: true,
  }

  const result = await applyAthleteDoseAdjustment({
    teamId: adjustment.teamId,
    athleteId: adjustment.athleteId,
    sourcePrescription,
    adjustmentId: adjustment.id,
    revisionId: 'revision-2',
    reason: 'Keep shared notes inherited',
    changedByUserId: 'coach-1',
    overrides: { distanceKm: 9 },
    persistence: persistence(currentRevision),
  })

  assert.equal(result.currentRevision.payload.dose && 'notes' in result.currentRevision.payload.dose, false)
})
