import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { reconcileSessionGeneration } from '@/lib/session-generation/session-regeneration'
import type {
  SharedEventPrescriptionProposal,
  SharedSessionEventProposal,
  SharedSessionGenerationResult,
} from '@/types/training/session-generation.types'

describe('regeneración idempotente de sesiones', () => {
  it('crea la primera propuesta y reemplaza los mismos registros al repetirla', () => {
    const proposal = generation(event('shared-tuesday', prescription('group-tuesday')))
    const first = reconcileSessionGeneration({
      proposal, existingEvents: [], existingPrescriptions: [],
    })
    const repeated = reconcileSessionGeneration({
      proposal,
      existingEvents: [{
        id: 'session-1', provenance: { ownership: 'generated', sharedEventKey: 'shared-tuesday' },
      }],
      existingPrescriptions: [{
        id: 'prescription-1', sessionId: 'session-1',
        provenance: { ownership: 'generated', generationKey: 'group-tuesday' },
      }],
    })

    assert.deepEqual(first.events.map(({ action }) => action), ['create'])
    assert.deepEqual(first.prescriptions.map(({ action }) => action), ['create'])
    assert.deepEqual(repeated.events.map(({ action, existingId }) => [action, existingId]), [['replace', 'session-1']])
    assert.deepEqual(
      repeated.prescriptions.map(({ action, existingId }) => [action, existingId]),
      [['replace', 'prescription-1']],
    )
    assert.deepEqual(repeated.obsoleteEventIds, [])
    assert.deepEqual(repeated.obsoletePrescriptionIds, [])
  })

  it('retira generados obsoletos cuando cambia la propuesta', () => {
    const result = reconcileSessionGeneration({
      proposal: generation(event('shared-thursday', prescription('group-thursday'))),
      existingEvents: [
        { id: 'session-old', provenance: { ownership: 'generated', sharedEventKey: 'shared-tuesday' } },
      ],
      existingPrescriptions: [{
        id: 'prescription-old', sessionId: 'session-old',
        provenance: { ownership: 'generated', generationKey: 'group-tuesday' },
      }],
    })

    assert.deepEqual(result.events.map(({ action }) => action), ['create'])
    assert.deepEqual(result.obsoleteEventIds, ['session-old'])
    assert.deepEqual(result.obsoletePrescriptionIds, ['prescription-old'])
  })

  it('no duplica una clave ocupada por un registro protegido', () => {
    const result = reconcileSessionGeneration({
      proposal: generation(event('shared-tuesday', prescription('group-tuesday'))),
      existingEvents: [{
        id: 'session-1',
        provenance: { ownership: 'generated_modified', sharedEventKey: 'shared-tuesday' },
      }],
      existingPrescriptions: [{
        id: 'prescription-1', sessionId: 'session-1',
        provenance: { ownership: 'generated_modified', generationKey: 'group-tuesday' },
      }],
    })

    assert.deepEqual(result.events, [])
    assert.deepEqual(result.prescriptions, [])
    assert.deepEqual(result.obsoleteEventIds, [])
    assert.deepEqual(result.obsoletePrescriptionIds, [])
    assert.deepEqual(result.protectedCollisions.map(({ kind }) => kind), ['event', 'prescription'])
  })

  it('ignora registros puramente manuales porque no poseen identidad generada', () => {
    const result = reconcileSessionGeneration({
      proposal: generation(event('shared-tuesday', prescription('group-tuesday'))),
      existingEvents: [{ id: 'manual-session', provenance: { ownership: 'manual', sharedEventKey: null } }],
      existingPrescriptions: [{
        id: 'manual-prescription', sessionId: 'manual-session',
        provenance: { ownership: 'manual', generationKey: null },
      }],
    })

    assert.deepEqual(result.events.map(({ action }) => action), ['create'])
    assert.deepEqual(result.prescriptions.map(({ action }) => action), ['create'])
    assert.deepEqual(result.obsoleteEventIds, [])
    assert.deepEqual(result.obsoletePrescriptionIds, [])
  })

  it('rechaza claves duplicadas en propuestas o registros existentes', () => {
    assert.throws(
      () => reconcileSessionGeneration({
        proposal: generation(event('shared', prescription('group')), event('shared', prescription('other'))),
        existingEvents: [], existingPrescriptions: [],
      }),
      /Duplicated sharedEventKey/,
    )
    assert.throws(
      () => reconcileSessionGeneration({
        proposal: generation(event('shared', prescription('group'))),
        existingEvents: [
          { id: 'one', provenance: { ownership: 'generated', sharedEventKey: 'shared' } },
          { id: 'two', provenance: { ownership: 'generated', sharedEventKey: 'shared' } },
        ],
        existingPrescriptions: [],
      }),
      /Duplicated sharedEventKey/,
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
      date: '2026-09-08', title: 'Rodaje', type: 'Base', sourceTemplateId: null,
      locationKey: null, trackPath: null, structure: null, notes: null,
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
      groupId: 'group-1', microcycleId: 'microcycle-1', distanceKm: 10,
      durationMin: null, elevationGain: 100, intensityMethod: 'hr_zone',
      zone: 'Z2', pamPercentage: null, notes: null,
    },
    warnings: [],
  }
}
