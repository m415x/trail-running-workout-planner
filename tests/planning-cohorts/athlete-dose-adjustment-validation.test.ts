import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  applyAthleteDoseAdjustment,
} from '@/lib/planning-cohorts/athlete-dose-adjustment'
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
  zone: 'Z2',
  referencePercentage: null,
  notes: 'Shared note',
}

function persistenceWithExisting() {
  const adjustments: PersistedAthleteSessionAdjustment[] = [{
    id: 'adjustment-1',
    teamId: 'team-1',
    athleteId: 'athlete-1',
    sourcePrescriptionId: 'prescription-1',
  }]
  const revisions: PersistedAthleteSessionAdjustmentRevision[] = [{
    id: 'revision-1',
    adjustmentId: 'adjustment-1',
    state: 'active',
    payload: {
      dose: null,
      assignment: { kind: 'inherit' },
    },
    reason: 'Initial',
    changedByUserId: 'coach-1',
    isCurrent: true,
  }]

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
        assert.ok(existing)
        for (const revision of revisions) {
          if (revision.adjustmentId === existing.id && revision.isCurrent) {
            revision.isCurrent = false
          }
        }
        revisions.push(input.revision)
        return {
          adjustment: existing,
          currentRevision: input.revision,
        }
      },
    },
  }
}

test('editing dose appends a revision on the existing logical adjustment', async () => {
  const persistence = persistenceWithExisting()

  const result = await applyAthleteDoseAdjustment({
    teamId: 'team-1',
    athleteId: 'athlete-1',
    sourcePrescription,
    adjustmentId: 'adjustment-1',
    revisionId: 'revision-2',
    reason: 'Update distance',
    changedByUserId: 'coach-1',
    overrides: { distanceKm: 8 },
    persistence: persistence.adapter,
  })

  assert.equal(persistence.adjustments.length, 1)
  assert.equal(persistence.revisions.length, 2)
  assert.equal(persistence.revisions[0]?.isCurrent, false)
  assert.equal(result.currentRevision.id, 'revision-2')
})

test('rejects invalid individual dose values before persistence', async () => {
  let writes = 0
  const persistence = {
    applyRevision: async () => {
      writes += 1
      throw new Error('should not write')
    },
  }

  await assert.rejects(
    () => applyAthleteDoseAdjustment({
      teamId: 'team-1',
      athleteId: 'athlete-1',
      sourcePrescription,
      adjustmentId: 'adjustment-1',
      revisionId: 'revision-invalid-distance',
      reason: 'Invalid',
      changedByUserId: 'coach-1',
      overrides: { distanceKm: -1 },
      persistence,
    }),
    /distance/i,
  )

  await assert.rejects(
    () => applyAthleteDoseAdjustment({
      teamId: 'team-1',
      athleteId: 'athlete-1',
      sourcePrescription,
      adjustmentId: 'adjustment-1',
      revisionId: 'revision-invalid-duration',
      reason: 'Invalid',
      changedByUserId: 'coach-1',
      overrides: { durationMin: -5 },
      persistence,
    }),
    /duration/i,
  )

  await assert.rejects(
    () => applyAthleteDoseAdjustment({
      teamId: 'team-1',
      athleteId: 'athlete-1',
      sourcePrescription,
      adjustmentId: 'adjustment-1',
      revisionId: 'revision-invalid-elevation',
      reason: 'Invalid',
      changedByUserId: 'coach-1',
      overrides: { elevationGain: -100 },
      persistence,
    }),
    /elevation/i,
  )

  await assert.rejects(
    () => applyAthleteDoseAdjustment({
      teamId: 'team-1',
      athleteId: 'athlete-1',
      sourcePrescription,
      adjustmentId: 'adjustment-1',
      revisionId: 'revision-invalid-reference',
      reason: 'Invalid',
      changedByUserId: 'coach-1',
      overrides: {
        intensity: {
          method: 'reference_percentage',
          referencePercentage: 0,
        },
      },
      persistence,
    }),
    /reference|percentage/i,
  )

  assert.equal(writes, 0)
})
