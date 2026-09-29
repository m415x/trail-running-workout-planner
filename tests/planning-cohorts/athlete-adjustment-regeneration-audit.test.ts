import assert from 'node:assert/strict'
import test from 'node:test'

import { reconcileSessionGeneration } from '@/lib/session-generation/session-regeneration'
import { resolveEffectiveAthleteAdjustment } from '@/lib/planning-cohorts/athlete-adjustment-resolution'
import {
  createAthleteSessionAdjustmentPersistenceAdapter,
  type PersistedAthleteSessionAdjustment,
  type PersistedAthleteSessionAdjustmentRevision,
} from '@/lib/planning-cohorts/athlete-session-adjustment-persistence'
import type {
  SharedEventPrescriptionProposal,
  SharedSessionEventProposal,
  SharedSessionGenerationResult,
} from '@/types/training/session-generation.types'

test('same generation identity replaces the existing prescription in place so exact-source adjustment remains effective', () => {
  const plan = reconcileSessionGeneration({
    proposal: generation(event('shared-tuesday', prescription('group-tuesday'))),
    existingEvents: [{
      id: 'session-1',
      provenance: { ownership: 'generated', sharedEventKey: 'shared-tuesday' },
    }],
    existingPrescriptions: [{
      id: 'prescription-1',
      sessionId: 'session-1',
      provenance: { ownership: 'generated', generationKey: 'group-tuesday' },
    }],
  })

  assert.deepEqual(plan.prescriptions, [{
    action: 'replace',
    existingId: 'prescription-1',
    proposal: prescription('group-tuesday'),
  }])

  const resolution = resolveEffectiveAthleteAdjustment({
    athleteId: 'athlete-1',
    effectivePrescriptionId: plan.prescriptions[0]!.existingId!,
    adjustment: adjustment,
    revisions: [firstRevision],
  })

  assert.equal(resolution.status, 'resolved')
})

test('new generation identity does not migrate an old exact-source adjustment', () => {
  const plan = reconcileSessionGeneration({
    proposal: generation(event('shared-thursday', prescription('group-thursday'))),
    existingEvents: [{
      id: 'session-1',
      provenance: { ownership: 'generated', sharedEventKey: 'shared-tuesday' },
    }],
    existingPrescriptions: [{
      id: 'prescription-1',
      sessionId: 'session-1',
      provenance: { ownership: 'generated', generationKey: 'group-tuesday' },
    }],
  })

  assert.equal(plan.prescriptions[0]?.action, 'create')
  assert.equal(plan.prescriptions[0]?.existingId, null)
  assert.deepEqual(plan.obsoletePrescriptionIds, ['prescription-1'])

  const resolution = resolveEffectiveAthleteAdjustment({
    athleteId: 'athlete-1',
    effectivePrescriptionId: 'prescription-new',
    adjustment,
    revisions: [firstRevision],
  })

  assert.deepEqual(resolution, {
    status: 'outside_authority',
    reason: 'source-prescription-mismatch',
    adjustmentId: 'adjustment-1',
  })
})

test('audit revisions remain append-only with reason and changedByUserId preserved', async () => {
  const port = createPort()
  const persistence = createAthleteSessionAdjustmentPersistenceAdapter(port)

  await persistence.applyRevision({
    adjustment,
    revision: firstRevision,
  })

  const secondRevision: PersistedAthleteSessionAdjustmentRevision = {
    ...firstRevision,
    id: 'revision-2',
    reason: 'Coach changed individual dose after review',
    changedByUserId: 'coach-2',
    payload: {
      ...firstRevision.payload,
      dose: {
        ...firstRevision.payload.dose!,
        distanceKm: { kind: 'override', value: 8 },
      },
    },
  }

  await persistence.applyRevision({
    adjustment,
    revision: secondRevision,
  })

  assert.equal(port.revisions.length, 2)
  assert.equal(port.revisions[0]!.isCurrent, false)
  assert.equal(port.revisions[0]!.reason, 'Initial Coach review')
  assert.equal(port.revisions[0]!.changedByUserId, 'coach-1')
  assert.equal(port.revisions[1]!.isCurrent, true)
  assert.equal(port.revisions[1]!.reason, 'Coach changed individual dose after review')
  assert.equal(port.revisions[1]!.changedByUserId, 'coach-2')
})

const adjustment: PersistedAthleteSessionAdjustment = {
  id: 'adjustment-1',
  teamId: 'team-1',
  athleteId: 'athlete-1',
  sourcePrescriptionId: 'prescription-1',
}

const firstRevision: PersistedAthleteSessionAdjustmentRevision = {
  id: 'revision-1',
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
  reason: 'Initial Coach review',
  changedByUserId: 'coach-1',
  isCurrent: true,
}

function createPort() {
  const adjustments: PersistedAthleteSessionAdjustment[] = []
  const revisions: PersistedAthleteSessionAdjustmentRevision[] = []

  return {
    adjustments,
    revisions,
    athleteBelongsToTeam: async () => true,
    prescriptionBelongsToTeam: async () => true,
    getAdjustmentByIdentity: async (athleteId: string, sourcePrescriptionId: string) =>
      adjustments.find(item =>
        item.athleteId === athleteId
        && item.sourcePrescriptionId === sourcePrescriptionId
      ) ?? null,
    listAdjustmentRevisions: async (adjustmentId: string) =>
      revisions.filter(item => item.adjustmentId === adjustmentId),
    insertAdjustmentWithRevision: async (
      nextAdjustment: PersistedAthleteSessionAdjustment,
      revision: PersistedAthleteSessionAdjustmentRevision,
    ) => {
      adjustments.push(nextAdjustment)
      revisions.push(revision)
    },
    replaceCurrentRevisionAtomically: async (
      previous: PersistedAthleteSessionAdjustmentRevision,
      replacement: PersistedAthleteSessionAdjustmentRevision,
    ) => {
      const index = revisions.findIndex(item => item.id === previous.id)
      revisions[index] = { ...previous, isCurrent: false }
      revisions.push(replacement)
    },
  }
}

function generation(...events: SharedSessionEventProposal[]): SharedSessionGenerationResult {
  return { events, warnings: [] }
}

function event(
  sharedEventKey: string,
  item: SharedEventPrescriptionProposal,
): SharedSessionEventProposal {
  return {
    sharedEventKey,
    session: {
      date: '2026-09-08',
      title: 'Rodaje',
      type: 'Base',
      sourceTemplateId: null,
      locationKey: null,
      trackPath: null,
      structure: null,
      notes: null,
    },
    prescriptions: [item],
    warnings: [],
  }
}

function prescription(generationKey: string): SharedEventPrescriptionProposal {
  return {
    generationKey,
    slotKey: 'weekly-tuesday',
    role: 'base',
    prescription: {
      groupId: 'group-1',
      microcycleId: 'microcycle-1',
      distanceKm: 10,
      durationMin: null,
      elevationGain: 100,
      intensityMethod: 'hr_zone',
      zone: 'Z2',
      referencePercentage: null,
      notes: null,
    },
    warnings: [],
  }
}
