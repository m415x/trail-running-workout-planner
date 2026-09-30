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

describe('GenerationExplanation ownership and regeneration', () => {
  it('explains generated records as replaceable by regeneration', () => {
    const proposal = generation(event('shared-tuesday', prescription('group-tuesday')))
    const plan = reconcileSessionGeneration({
      proposal,
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

    const result = explainOwnershipAndRegeneration({
      reconciliation: plan,
      eventOwnership: 'generated',
      prescriptionOwnership: 'generated',
    })

    assert.ok(result.coordination.decision.some((fact) => (
      fact.code === 'event_regeneration_action' && fact.value === 'replace'
    )))
    assert.ok(result.coordination.decision.some((fact) => (
      fact.code === 'prescription_regeneration_action' && fact.value === 'replace'
    )))
    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'generator_may_replace_current_state' && fact.value === true
    )))
  })

  it('explains generated_modified as generated origin with Coach-protected current state', () => {
    const proposal = generation(event('shared-tuesday', prescription('group-tuesday')))
    const plan = reconcileSessionGeneration({
      proposal,
      existingEvents: [{
        id: 'session-1',
        provenance: { ownership: 'generated_modified', sharedEventKey: 'shared-tuesday' },
      }],
      existingPrescriptions: [{
        id: 'prescription-1',
        sessionId: 'session-1',
        provenance: { ownership: 'generated_modified', generationKey: 'group-tuesday' },
      }],
    })

    const result = explainOwnershipAndRegeneration({
      reconciliation: plan,
      eventOwnership: 'generated_modified',
      prescriptionOwnership: 'generated_modified',
    })

    assert.ok(result.coordination.inputs.some((fact) => (
      fact.code === 'generated_origin_retained' && fact.value === true
    )))
    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'current_state_coach_protected' && fact.value === true
    )))
    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'generator_may_replace_current_state' && fact.value === false
    )))
    assert.ok(result.coordination.warnings.some((warning) => (
      warning.code === 'protected_generation_collision'
    )))
  })

  it('never attributes manual state to the generator', () => {
    const proposal = generation(event('shared-tuesday', prescription('group-tuesday')))
    const plan = reconcileSessionGeneration({
      proposal,
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

    assert.ok(result.coordination.inputs.some((fact) => (
      fact.code === 'event_ownership' && fact.value === 'manual'
    )))
    assert.ok(result.coordination.inputs.some((fact) => (
      fact.code === 'prescription_ownership' && fact.value === 'manual'
    )))
    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'generated_origin_retained' && fact.value === false
    )))
    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'generator_may_replace_current_state' && fact.value === false
    )))
    assert.equal(
      result.coordination.decision.some((fact) => fact.code === 'generator_decision'),
      false,
    )
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
