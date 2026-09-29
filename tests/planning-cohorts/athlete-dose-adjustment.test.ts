import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  applyAthleteDoseAdjustment,
} from '@/lib/planning-cohorts/athlete-dose-adjustment'
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

const audiencePrescription: EffectiveAudiencePrescription = {
  id: 'prescription-1',
  distanceKm: 12,
  durationMin: 95,
  elevationGain: 650,
  intensityMethod: 'hr_zone',
  zone: 'Z2',
  referencePercentage: null,
  notes: 'Priorizá el esfuerzo sobre el ritmo',
}

function createPersistence() {
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

        if (!existing) {
          adjustments.push(input.adjustment)
        } else {
          for (const revision of revisions) {
            if (revision.adjustmentId === existing.id && revision.isCurrent) {
              revision.isCurrent = false
            }
          }
        }

        revisions.push(input.revision)
        return {
          adjustment: existing ?? input.adjustment,
          currentRevision: input.revision,
        }
      },
    },
  }
}

test('dose-only adjustment persists a delta and leaves the audience prescription unchanged', async () => {
  const persistence = createPersistence()
  const originalAudience = structuredClone(audiencePrescription)

  const result = await applyAthleteDoseAdjustment({
    teamId: 'team-1',
    athleteId: 'athlete-1',
    sourcePrescription: audiencePrescription,
    adjustmentId: 'adjustment-1',
    revisionId: 'revision-1',
    reason: 'Reduce volume for this athlete',
    changedByUserId: 'coach-1',
    overrides: {
      distanceKm: 9,
      elevationGain: 400,
    },
    persistence: persistence.adapter,
  })

  assert.deepEqual(audiencePrescription, originalAudience)
  assert.equal(persistence.adjustments.length, 1)
  assert.equal(persistence.revisions.length, 1)
  assert.equal(result.currentRevision.payload.assignment.kind, 'inherit')

  const effective = resolveAthletePlannedSession({
    athleteId: 'athlete-1',
    session,
    prescription: audiencePrescription,
    adjustment: {
      id: result.adjustment.id,
      athleteId: result.adjustment.athleteId,
      sourcePrescriptionId: result.adjustment.sourcePrescriptionId,
      dose: result.currentRevision.payload.dose,
      assignment: result.currentRevision.payload.assignment,
    },
  })

  assert.equal(effective.status, 'resolved')
  assert.equal(effective.prescription.distanceKm, 9)
  assert.equal(effective.prescription.durationMin, 95)
  assert.equal(effective.prescription.elevationGain, 400)
  assert.equal(effective.prescription.zone, 'Z2')
})

test('dose-only adjustment updates only explicitly supplied fields', async () => {
  const persistence = createPersistence()

  const result = await applyAthleteDoseAdjustment({
    teamId: 'team-1',
    athleteId: 'athlete-1',
    sourcePrescription: audiencePrescription,
    adjustmentId: 'adjustment-1',
    revisionId: 'revision-1',
    reason: 'Intensity exception',
    changedByUserId: 'coach-1',
    overrides: {
      intensity: {
        method: 'reference_percentage',
        referencePercentage: 82,
      },
      notes: 'Control effort on climbs',
    },
    persistence: persistence.adapter,
  })

  const dose = result.currentRevision.payload.dose!
  assert.deepEqual(dose.distanceKm, { kind: 'inherit' })
  assert.deepEqual(dose.durationMin, { kind: 'inherit' })
  assert.deepEqual(dose.elevationGain, { kind: 'inherit' })
  assert.deepEqual(dose.intensity, {
    kind: 'override',
    value: {
      method: 'reference_percentage',
      referencePercentage: 82,
    },
  })
  assert.deepEqual(dose.notes, {
    kind: 'override',
    value: 'Control effort on climbs',
  })
})

test('a sibling athlete remains on the shared audience dose', async () => {
  const persistence = createPersistence()

  const result = await applyAthleteDoseAdjustment({
    teamId: 'team-1',
    athleteId: 'athlete-1',
    sourcePrescription: audiencePrescription,
    adjustmentId: 'adjustment-1',
    revisionId: 'revision-1',
    reason: 'Individual volume reduction',
    changedByUserId: 'coach-1',
    overrides: { distanceKm: 9 },
    persistence: persistence.adapter,
  })

  const athleteOne = resolveAthletePlannedSession({
    athleteId: 'athlete-1',
    session,
    prescription: audiencePrescription,
    adjustment: {
      id: result.adjustment.id,
      athleteId: result.adjustment.athleteId,
      sourcePrescriptionId: result.adjustment.sourcePrescriptionId,
      dose: result.currentRevision.payload.dose,
      assignment: result.currentRevision.payload.assignment,
    },
  })
  const athleteTwo = resolveAthletePlannedSession({
    athleteId: 'athlete-2',
    session,
    prescription: audiencePrescription,
    adjustment: null,
  })

  assert.equal(athleteOne.status, 'resolved')
  assert.equal(athleteOne.prescription.distanceKm, 9)
  assert.equal(athleteTwo.status, 'resolved')
  assert.equal(athleteTwo.prescription.distanceKm, 12)
})

test('same-authority regeneration keeps the Coach-owned individual delta effective', async () => {
  const persistence = createPersistence()

  const result = await applyAthleteDoseAdjustment({
    teamId: 'team-1',
    athleteId: 'athlete-1',
    sourcePrescription: audiencePrescription,
    adjustmentId: 'adjustment-1',
    revisionId: 'revision-1',
    reason: 'Individual cap',
    changedByUserId: 'coach-1',
    overrides: { distanceKm: 9 },
    persistence: persistence.adapter,
  })

  const regeneratedAudience: EffectiveAudiencePrescription = {
    ...audiencePrescription,
    durationMin: 100,
    elevationGain: 700,
  }

  const effective = resolveAthletePlannedSession({
    athleteId: 'athlete-1',
    session,
    prescription: regeneratedAudience,
    adjustment: {
      id: result.adjustment.id,
      athleteId: result.adjustment.athleteId,
      sourcePrescriptionId: result.adjustment.sourcePrescriptionId,
      dose: result.currentRevision.payload.dose,
      assignment: result.currentRevision.payload.assignment,
    },
  })

  assert.equal(effective.status, 'resolved')
  assert.equal(effective.prescription.distanceKm, 9)
  assert.equal(effective.prescription.durationMin, 100)
  assert.equal(effective.prescription.elevationGain, 700)
})
