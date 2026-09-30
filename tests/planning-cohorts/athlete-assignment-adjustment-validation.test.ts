import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  applyAthleteAssignmentAdjustment,
} from '@/lib/planning-cohorts/athlete-assignment-adjustment'
import type { EffectiveAudiencePrescription } from '@/lib/planning-cohorts/athlete-session-adjustment'
import type {
  PersistedAthleteSessionAdjustment,
  PersistedAthleteSessionAdjustmentRevision,
} from '@/lib/planning-cohorts/athlete-session-adjustment-persistence'

const sourcePrescription: EffectiveAudiencePrescription = {
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
      assignment: { kind: 'rescheduled', date: '2026-10-07' },
    },
    reason: 'Initial move',
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
        revisions.forEach(revision => {
          if (revision.adjustmentId === existing.id && revision.isCurrent) {
            revision.isCurrent = false
          }
        })
        revisions.push(input.revision)
        return {
          adjustment: existing,
          currentRevision: input.revision,
        }
      },
    },
  }
}

test('editing assignment appends a new revision on the same logical adjustment', async () => {
  const store = persistenceWithExisting()

  const result = await applyAthleteAssignmentAdjustment({
    teamId: 'team-1',
    athleteId: 'athlete-1',
    sourcePrescription,
    adjustmentId: 'adjustment-1',
    revisionId: 'revision-2',
    reason: 'Now omit instead',
    changedByUserId: 'coach-1',
    assignment: { kind: 'omitted' },
    persistence: store.adapter,
  })

  assert.equal(store.adjustments.length, 1)
  assert.equal(store.revisions.length, 2)
  assert.equal(store.revisions[0]?.isCurrent, false)
  assert.equal(result.currentRevision.state, 'active')
  assert.deepEqual(result.currentRevision.payload.assignment, { kind: 'omitted' })
})

test('rejects invalid reschedule or stimulus replacement before persistence', async () => {
  let writes = 0
  const persistence = {
    applyRevision: async () => {
      writes += 1
      throw new Error('should not write')
    },
  }

  await assert.rejects(
    () => applyAthleteAssignmentAdjustment({
      teamId: 'team-1',
      athleteId: 'athlete-1',
      sourcePrescription,
      adjustmentId: 'adjustment-1',
      revisionId: 'revision-invalid-date',
      reason: 'Invalid date',
      changedByUserId: 'coach-1',
      assignment: { kind: 'rescheduled', date: '   ' },
      persistence,
    }),
    /date/i,
  )

  assert.equal(writes, 0)
})
