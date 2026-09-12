import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildIntegralPlanningDiff } from '@/lib/periodization/planning-review-diff'
import type { IntegralPlanningReview } from '@/types/training/planning-review.types'

const baseEntity = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function buildReview(): IntegralPlanningReview {
  return {
    scope: {
      teamId: 'team-1',
      groupId: 'group-1',
      groupTrainingPlanId: 'plan-1',
      kind: 'group_base',
      planningCohortId: null,
      sourceGroupTrainingPlanId: null,
    },
    plan: {
      ...baseEntity,
      id: 'plan-1',
      groupId: 'group-1',
      planningCohortId: null,
      sourceGroupTrainingPlanId: null,
      title: 'Plan base',
      status: 'active',
    },
    loadStrategy: null,
    intensityStrategy: null,
    macrocycles: [{
      macrocycle: {
        ...baseEntity,
        id: 'macro-1',
        groupTrainingPlanId: 'plan-1',
        title: 'Macro',
        startDate: '2026-01-05',
        endDate: '2026-01-11',
      },
      mesocycles: [{
        mesocycle: {
          ...baseEntity,
          id: 'meso-1',
          macrocycleId: 'macro-1',
          title: 'Base',
          number: 1,
          period: 'general_preparatory',
          objective: 'Construir base',
        },
        microcycles: [{
          microcycle: {
            ...baseEntity,
            id: 'micro-1',
            mesocycleId: 'meso-1',
            weekNumber: 1,
            type: 'development',
            startDate: '2026-01-05',
            endDate: '2026-01-11',
            targetVolumeKm: 40,
            targetVolumeSource: 'generated',
            targetElevationGain: 1_000,
            targetElevationSource: 'generated',
          },
          targets: {
            targetVolumeKm: 40,
            targetVolumeSource: 'generated',
            targetElevationGainM: 1_000,
            targetElevationSource: 'generated',
            targetDurationMin: null,
          },
          intensityTarget: null,
          competitiveAdjustmentValueSources: null,
          sessions: [{
            session: {
              ...baseEntity,
              id: 'session-generated',
              teamId: 'team-1',
              date: '2026-01-07',
              title: 'Montaña',
              type: 'Trail',
            },
            provenance: {
              ownership: 'generated',
              sharedEventKey: 'plan-1::micro-1::shared-wednesday',
            },
            prescriptions: [{
              prescription: {
                ...baseEntity,
                id: 'prescription-generated',
                sessionId: 'session-generated',
                groupId: 'group-1',
                microcycleId: 'micro-1',
              },
              provenance: {
                ownership: 'generated',
                generationKey: 'plan-1::micro-1::group-1::wednesday',
              },
            }],
          }, {
            session: {
              ...baseEntity,
              id: 'session-manual',
              teamId: 'team-1',
              date: '2026-01-10',
              title: 'Salida del profesor',
              type: 'Long',
            },
            provenance: {
              ownership: 'manual',
              sharedEventKey: null,
            },
            prescriptions: [],
          }],
        }],
      }],
    }],
    competitions: [],
    protectedValues: [],
    issues: [],
  }
}

function microcycle(review: IntegralPlanningReview) {
  return review.macrocycles[0].mesocycles[0].microcycles[0]
}

describe('diff integral de planificación', () => {
  it('clasifica un agregado idéntico como preservado sin mutar entradas', () => {
    const current = buildReview()
    const proposed = structuredClone(current)
    const currentSnapshot = structuredClone(current)
    const proposedSnapshot = structuredClone(proposed)

    const diff = buildIntegralPlanningDiff(current, proposed)

    assert.equal(diff.hasConflicts, false)
    assert.equal(diff.items.every(({ classification }) => classification === 'preserved'), true)
    assert.deepEqual(diff.counts, {
      added: 0,
      updated: 0,
      preserved: 7,
      conflict: 0,
    })
    assert.deepEqual(current, currentSnapshot)
    assert.deepEqual(proposed, proposedSnapshot)
  })

  it('diferencia actualización y retiro generado de preservación manual', () => {
    const current = buildReview()
    const proposed = structuredClone(current)
    const proposedMicrocycle = microcycle(proposed)
    Object.assign(proposedMicrocycle.microcycle, { targetVolumeKm: 42 })
    Object.assign(proposedMicrocycle.targets, { targetVolumeKm: 42 })
    Object.assign(proposedMicrocycle, { sessions: [] })

    const diff = buildIntegralPlanningDiff(current, proposed)
    const generatedSession = diff.items.find(({ identity }) => (
      identity === 'session:generation:plan-1::micro-1::shared-wednesday'
    ))
    const generatedPrescription = diff.items.find(({ identity }) => (
      identity === 'prescription:generation:plan-1::micro-1::group-1::wednesday'
    ))
    const manualSession = diff.items.find(({ identity }) => (
      identity === 'session:id:session-manual'
    ))
    const week = diff.items.find(({ identity }) => identity === 'microcycle:id:micro-1')

    assert.deepEqual(
      [week?.classification, week?.operation],
      ['updated', 'update'],
    )
    assert.deepEqual(
      [generatedSession?.classification, generatedSession?.operation],
      ['updated', 'remove'],
    )
    assert.deepEqual(
      [generatedPrescription?.classification, generatedPrescription?.operation],
      ['updated', 'remove'],
    )
    assert.deepEqual(
      [manualSession?.classification, manualSession?.operation, manualSession?.reason],
      ['preserved', 'none', 'protected_absence'],
    )
  })

  it('clasifica una nueva sesión generada como alta', () => {
    const current = buildReview()
    const proposed = structuredClone(current)
    const proposedMicrocycle = microcycle(proposed)
    const newSession = {
      session: {
        ...baseEntity,
        id: 'session-new',
        teamId: 'team-1',
        date: '2026-01-09',
        title: 'Rodaje nuevo',
        type: 'Base' as const,
      },
      provenance: {
        ownership: 'generated' as const,
        sharedEventKey: 'plan-1::micro-1::shared-friday',
      },
      prescriptions: [],
    }
    Object.assign(proposedMicrocycle, {
      sessions: [...proposedMicrocycle.sessions, newSession],
    })

    const diff = buildIntegralPlanningDiff(current, proposed)
    const added = diff.items.find(({ identity }) => (
      identity === 'session:generation:plan-1::micro-1::shared-friday'
    ))

    assert.deepEqual(
      [added?.classification, added?.operation, added?.reason],
      ['added', 'create', 'new_entity'],
    )
  })

  it('marca conflicto al cambiar volumen manual o una sesión protegida', () => {
    const current = buildReview()
    const currentMicrocycle = microcycle(current)
    Object.assign(currentMicrocycle.microcycle, {
      targetVolumeSource: 'manual',
    })
    Object.assign(currentMicrocycle.targets, {
      targetVolumeSource: 'manual',
    })
    const generatedSession = currentMicrocycle.sessions[0]
    Object.assign(generatedSession.provenance, {
      ownership: 'generated_modified',
    })

    const proposed = structuredClone(current)
    const proposedMicrocycle = microcycle(proposed)
    Object.assign(proposedMicrocycle.microcycle, { targetVolumeKm: 45 })
    Object.assign(proposedMicrocycle.targets, { targetVolumeKm: 45 })
    Object.assign(proposedMicrocycle.sessions[0].session, {
      title: 'Cambio regenerado',
    })

    const diff = buildIntegralPlanningDiff(current, proposed)
    const week = diff.items.find(({ identity }) => identity === 'microcycle:id:micro-1')
    const session = diff.items.find(({ identity }) => (
      identity === 'session:generation:plan-1::micro-1::shared-wednesday'
    ))

    assert.equal(diff.hasConflicts, true)
    assert.deepEqual(
      [week?.classification, week?.reason],
      ['conflict', 'protected_change'],
    )
    assert.deepEqual(
      [session?.classification, session?.reason],
      ['conflict', 'protected_change'],
    )
  })

  it('usa claves H6 para detectar un cambio de ID como conflicto, no alta duplicada', () => {
    const current = buildReview()
    const proposed = structuredClone(current)
    const proposedSession = microcycle(proposed).sessions[0]
    Object.assign(proposedSession.session, { id: 'session-recreated' })
    Object.assign(proposedSession.prescriptions[0].prescription, {
      id: 'prescription-recreated',
      sessionId: 'session-recreated',
    })

    const diff = buildIntegralPlanningDiff(current, proposed)
    const sessionItems = diff.items.filter(({ entity }) => entity.entityType === 'session')
    const prescriptionItems = diff.items.filter(({ entity }) => (
      entity.entityType === 'prescription'
    ))

    assert.equal(sessionItems.length, 2)
    assert.equal(prescriptionItems.length, 1)
    assert.equal(
      sessionItems.some(({ classification }) => classification === 'conflict'),
      true,
    )
    assert.equal(prescriptionItems[0].classification, 'conflict')
  })
})
