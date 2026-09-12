import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { reconcileAcceptedPlanningBlocks } from '@/lib/periodization/planning-review-reconciliation'
import type { IntegralPlanningReview } from '@/types/training/planning-review.types'

const baseEntity = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function buildReview(): IntegralPlanningReview {
  const macrocycle = (
    number: number,
    startDate: string,
    endDate: string,
    targetVolumeKm: number,
  ) => ({
    macrocycle: {
      ...baseEntity,
      id: `macro-${number}`,
      groupTrainingPlanId: 'plan-variant',
      title: `Macro ${number}`,
      startDate,
      endDate,
    },
    mesocycles: [{
      mesocycle: {
        ...baseEntity,
        id: `meso-${number}`,
        macrocycleId: `macro-${number}`,
        title: `Meso ${number}`,
        number,
        period: 'general_preparatory' as const,
        objective: 'Construir base',
      },
      microcycles: [{
        microcycle: {
          ...baseEntity,
          id: `micro-${number}`,
          mesocycleId: `meso-${number}`,
          weekNumber: number,
          type: 'development' as const,
          startDate,
          endDate,
          targetVolumeKm,
          targetVolumeSource: 'generated' as const,
          targetElevationGain: 1_000,
          targetElevationSource: 'generated' as const,
        },
        targets: {
          targetVolumeKm,
          targetVolumeSource: 'generated' as const,
          targetElevationGainM: 1_000,
          targetElevationSource: 'generated' as const,
          targetDurationMin: null,
        },
        intensityTarget: null,
        competitiveAdjustmentValueSources: null,
        sessions: [],
      }],
    }],
  })

  return {
    scope: {
      teamId: 'team-1',
      groupId: 'group-1',
      groupTrainingPlanId: 'plan-variant',
      kind: 'cohort_variant',
      planningCohortId: 'cohort-1',
      sourceGroupTrainingPlanId: 'plan-base',
    },
    plan: {
      ...baseEntity,
      id: 'plan-variant',
      groupId: 'group-1',
      planningCohortId: 'cohort-1',
      sourceGroupTrainingPlanId: 'plan-base',
      title: 'Plan de cohorte',
      status: 'active',
    },
    loadStrategy: null,
    intensityStrategy: null,
    macrocycles: [
      macrocycle(1, '2026-01-05', '2026-01-11', 40),
      macrocycle(2, '2026-01-12', '2026-01-18', 50),
    ],
    competitions: [],
    protectedValues: [],
    issues: [],
  }
}

function microcycle(review: IntegralPlanningReview, macroIndex: number) {
  return review.macrocycles[macroIndex].mesocycles[0].microcycles[0]
}

const coach = {
  source: 'coach' as const,
  coachId: 'coach-1',
  decidedAt: '2026-09-12T16:00:00.000-03:00',
  reason: 'Rango revisado',
}

describe('reconciliación parcial integral', () => {
  it('emite únicamente las operaciones del bloque aceptado sin expandir el macrociclo', () => {
    const current = buildReview()
    const proposed = structuredClone(current)
    const currentSnapshot = structuredClone(current)
    const proposedMicrocycle = microcycle(proposed, 0)
    Object.assign(proposedMicrocycle.microcycle, { targetVolumeKm: 42 })
    Object.assign(proposedMicrocycle.targets, { targetVolumeKm: 42 })
    Object.assign(proposedMicrocycle, {
      sessions: [{
        session: {
          ...baseEntity,
          id: 'session-1',
          teamId: 'team-1',
          date: '2026-01-07',
          title: 'Montaña',
          type: 'Trail',
        },
        provenance: {
          ownership: 'generated',
          sharedEventKey: 'plan-variant::micro-1::wednesday',
        },
        prescriptions: [{
          prescription: {
            ...baseEntity,
            id: 'prescription-1',
            sessionId: 'session-1',
            groupId: 'group-1',
            microcycleId: 'micro-1',
          },
          provenance: {
            ownership: 'generated',
            generationKey: 'plan-variant::micro-1::group-1::wednesday',
          },
        }],
      }],
    })
    const proposedSecond = microcycle(proposed, 1)
    Object.assign(proposedSecond.microcycle, { targetVolumeKm: 52 })
    Object.assign(proposedSecond.targets, { targetVolumeKm: 52 })
    const proposedSnapshot = structuredClone(proposed)

    const result = reconcileAcceptedPlanningBlocks({
      current,
      proposed,
      decisions: [{
        blockId: 'macrocycle:macrocycle:id:macro-1',
        decision: 'accept',
        provenance: coach,
      }, {
        blockId: 'macrocycle:macrocycle:id:macro-2',
        decision: 'reject',
        provenance: { ...coach, reason: 'Mantener segunda semana' },
      }],
    })

    assert.deepEqual(result.scope, proposed.scope)
    assert.equal(result.scope.kind, 'cohort_variant')
    assert.deepEqual(result.blocks[0]?.range, {
      startDate: '2026-01-05',
      endDate: '2026-01-11',
    })
    assert.deepEqual(result.operations.map(({ identity }) => identity), [
      'microcycle:id:micro-1',
      'prescription:generation:plan-variant::micro-1::group-1::wednesday',
      'session:generation:plan-variant::micro-1::wednesday',
    ])
    assert.equal(
      result.operations.some(({ identity }) => identity === 'microcycle:id:micro-2'),
      false,
    )
    assert.equal(result.planningOperations.length, 1)
    assert.equal(result.sessionOperations.length, 1)
    assert.equal(result.prescriptionOperations.length, 1)
    assert.equal(result.competitionOperations.length, 0)
    assert.deepEqual(result.rejectedBlockIds, [
      'macrocycle:macrocycle:id:macro-2',
    ])
    assert.deepEqual(result.operations[0]?.decisionProvenance, coach)
    assert.deepEqual(current, currentSnapshot)
    assert.deepEqual(proposed, proposedSnapshot)
  })

  it('mantiene pendientes fuera del write set', () => {
    const current = buildReview()
    const proposed = structuredClone(current)
    const first = microcycle(proposed, 0)
    const second = microcycle(proposed, 1)
    Object.assign(first.microcycle, { targetVolumeKm: 42 })
    Object.assign(first.targets, { targetVolumeKm: 42 })
    Object.assign(second.microcycle, { targetVolumeKm: 52 })
    Object.assign(second.targets, { targetVolumeKm: 52 })

    const result = reconcileAcceptedPlanningBlocks({
      current,
      proposed,
      decisions: [{
        blockId: 'macrocycle:macrocycle:id:macro-1',
        decision: 'accept',
        provenance: coach,
      }],
    })

    assert.deepEqual(result.acceptedItemIdentities, ['microcycle:id:micro-1'])
    assert.deepEqual(result.pendingBlockIds, [
      'macrocycle:macrocycle:id:macro-2',
    ])
  })

  it('rechaza una selección que intenta aceptar cambios protegidos', () => {
    const current = buildReview()
    const currentFirst = microcycle(current, 0)
    Object.assign(currentFirst.microcycle, { targetVolumeSource: 'manual' })
    Object.assign(currentFirst.targets, { targetVolumeSource: 'manual' })
    const proposed = structuredClone(current)
    Object.assign(microcycle(proposed, 0).microcycle, { targetVolumeKm: 45 })
    Object.assign(microcycle(proposed, 0).targets, { targetVolumeKm: 45 })

    assert.throws(
      () => reconcileAcceptedPlanningBlocks({
        current,
        proposed,
        decisions: [{
          blockId: 'macrocycle:macrocycle:id:macro-1',
          decision: 'accept',
          provenance: coach,
        }],
      }),
      /conflicted_block_accepted/,
    )
  })

  it('impide reconciliar entre alcances de grupo o cohorte distintos', () => {
    const current = buildReview()
    const proposed = structuredClone(current)
    Object.assign(proposed.scope, { planningCohortId: 'cohort-2' })

    assert.throws(
      () => reconcileAcceptedPlanningBlocks({ current, proposed, decisions: [] }),
      /same group\/cohort scope/,
    )
  })
})
