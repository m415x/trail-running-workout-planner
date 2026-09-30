import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  explainOwnershipAndRegeneration,
} from '@/lib/session-generation/generation-explanation'
import { reconcileSessionGeneration } from '@/lib/session-generation/session-regeneration'
import type {
  SharedEventPrescriptionProposal,
  SharedSessionEventProposal,
  SharedSessionGenerationResult,
} from '@/types/training/session-generation.types'

describe('GenerationExplanation regeneration retirement semantics', () => {
  it('explains generated records as obsolete when they are no longer proposed', () => {
    const plan = reconcileSessionGeneration({
      proposal: generation(event('shared-new', prescription('group-new'))),
      existingEvents: [{
        id: 'session-old',
        provenance: { ownership: 'generated', sharedEventKey: 'shared-old' },
      }],
      existingPrescriptions: [{
        id: 'prescription-old',
        sessionId: 'session-old',
        provenance: { ownership: 'generated', generationKey: 'group-old' },
      }],
    })

    const result = explainOwnershipAndRegeneration({
      reconciliation: plan,
      eventOwnership: 'generated',
      prescriptionOwnership: 'generated',
    })

    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'obsolete_event_ids' && fact.value === 'session-old'
    )))
    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'obsolete_prescription_ids' && fact.value === 'prescription-old'
    )))
    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'preserved_record_count' && fact.value === 0
    )))
  })

  it('explains generated_modified records as preserved when they are no longer proposed', () => {
    const plan = reconcileSessionGeneration({
      proposal: generation(event('shared-new', prescription('group-new'))),
      existingEvents: [{
        id: 'session-edited',
        provenance: { ownership: 'generated_modified', sharedEventKey: 'shared-old' },
      }],
      existingPrescriptions: [{
        id: 'prescription-edited',
        sessionId: 'session-edited',
        provenance: { ownership: 'generated_modified', generationKey: 'group-old' },
      }],
    })

    const result = explainOwnershipAndRegeneration({
      reconciliation: plan,
      eventOwnership: 'generated_modified',
      prescriptionOwnership: 'generated_modified',
    })

    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'obsolete_event_ids' && fact.value === ''
    )))
    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'obsolete_prescription_ids' && fact.value === ''
    )))
    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'preserved_record_count' && fact.value === 2
    )))
    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'preserved_records' &&
      fact.value === 'event:session-edited:no_longer_proposed,prescription:prescription-edited:no_longer_proposed'
    )))
  })

  it('keeps manual records preserved without generated identity', () => {
    const plan = reconcileSessionGeneration({
      proposal: generation(event('shared-new', prescription('group-new'))),
      existingEvents: [{
        id: 'manual-session',
        provenance: { ownership: 'manual', sharedEventKey: null },
      }],
      existingPrescriptions: [{
        id: 'manual-prescription',
        sessionId: 'manual-session',
        provenance: { ownership: 'manual', generationKey: null },
      }],
    })

    const result = explainOwnershipAndRegeneration({
      reconciliation: plan,
      eventOwnership: 'manual',
      prescriptionOwnership: 'manual',
    })

    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'preserved_records' &&
      fact.value === 'event:manual-session:manual,prescription:manual-prescription:manual'
    )))
    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'generated_origin_retained' && fact.value === false
    )))
  })
})

function generation(...events: SharedSessionEventProposal[]): SharedSessionGenerationResult {
  return { events, warnings: [] }
}

function event(
  sharedEventKey: string,
  groupPrescription: SharedEventPrescriptionProposal,
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
    prescriptions: [groupPrescription],
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
