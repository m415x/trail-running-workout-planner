import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildPlanningReviewDecisionBlocks,
  validatePlanningReviewBlockSelection,
} from '@/lib/periodization/planning-review-blocks'
import type { IntegralPlanningDiff } from '@/types/training/planning-review-diff.types'

function buildDiff(): IntegralPlanningDiff {
  return {
    items: [{
      identity: 'plan:id:plan-1',
      parentIdentity: null,
      entity: { entityType: 'plan', entityId: 'plan-1' },
      classification: 'updated',
      operation: 'update',
      reason: 'generated_change',
      changes: [{ field: 'title', currentValue: 'Plan', proposedValue: 'Plan 2027' }],
    }, {
      identity: 'macrocycle:id:macro-1',
      parentIdentity: 'plan:id:plan-1',
      entity: { entityType: 'macrocycle', entityId: 'macro-1' },
      classification: 'updated',
      operation: 'update',
      reason: 'generated_change',
      changes: [{ field: 'endDate', currentValue: '2027-03-01', proposedValue: '2027-03-08' }],
    }, {
      identity: 'microcycle:id:micro-1',
      parentIdentity: 'mesocycle:id:meso-1',
      entity: { entityType: 'microcycle', entityId: 'micro-1' },
      classification: 'updated',
      operation: 'update',
      reason: 'generated_change',
      changes: [{ field: 'targetVolumeKm', currentValue: 40, proposedValue: 42 }],
    }, {
      identity: 'mesocycle:id:meso-1',
      parentIdentity: 'macrocycle:id:macro-1',
      entity: { entityType: 'mesocycle', entityId: 'meso-1' },
      classification: 'preserved',
      operation: 'none',
      reason: 'unchanged',
      changes: [],
    }, {
      identity: 'session:generation:shared-1',
      parentIdentity: 'microcycle:id:micro-1',
      entity: { entityType: 'session', entityId: 'session-1' },
      classification: 'added',
      operation: 'create',
      reason: 'new_entity',
      changes: [{ field: '$entity', currentValue: null, proposedValue: { id: 'session-1' } }],
    }, {
      identity: 'prescription:generation:group-1',
      parentIdentity: 'session:generation:shared-1',
      entity: { entityType: 'prescription', entityId: 'prescription-1' },
      classification: 'added',
      operation: 'create',
      reason: 'new_entity',
      changes: [{ field: '$entity', currentValue: null, proposedValue: { id: 'prescription-1' } }],
    }, {
      identity: 'competition:id:competition-1',
      parentIdentity: 'plan:id:plan-1',
      entity: { entityType: 'competition', entityId: 'competition-1' },
      classification: 'updated',
      operation: 'update',
      reason: 'generated_change',
      changes: [{ field: 'priority', currentValue: 'B', proposedValue: 'A' }],
    }],
    counts: { added: 2, updated: 4, preserved: 1, conflict: 0 },
    issues: [],
    hasConflicts: false,
  }
}

describe('decisiones por bloques de revisión integral', () => {
  it('mantiene junto un macrociclo completo y declara su dependencia del plan', () => {
    const diff = buildDiff()
    const snapshot = structuredClone(diff)

    const review = buildPlanningReviewDecisionBlocks(diff)
    const macroBlock = review.blocks.find(({ kind }) => kind === 'macrocycle')
    const competitionBlock = review.blocks.find(({ kind }) => kind === 'competition')
    const planBlock = review.blocks.find(({ kind }) => kind === 'plan')

    assert.equal(review.blocks.length, 3)
    assert.deepEqual(macroBlock?.itemIdentities, [
      'macrocycle:id:macro-1',
      'microcycle:id:micro-1',
      'prescription:generation:group-1',
      'session:generation:shared-1',
    ])
    assert.deepEqual(macroBlock?.dependencyBlockIds, [planBlock?.id])
    assert.deepEqual(competitionBlock?.dependencyBlockIds, [planBlock?.id])
    assert.deepEqual(diff, snapshot)
  })

  it('impide aceptar un bloque sin aceptar antes sus dependencias', () => {
    const review = buildPlanningReviewDecisionBlocks(buildDiff())
    const macroBlock = review.blocks.find(({ kind }) => kind === 'macrocycle')
    assert.ok(macroBlock)

    const selection = validatePlanningReviewBlockSelection(review, [{
      blockId: macroBlock.id,
      decision: 'accept',
      provenance: {
        source: 'coach',
        coachId: 'coach-1',
        decidedAt: '2026-09-12T15:00:00.000-03:00',
        reason: 'Apruebo la progresión',
      },
    }])

    assert.equal(selection.isValid, false)
    assert.equal(selection.issues[0]?.code, 'dependency_not_accepted')
    assert.equal(selection.acceptedItemIdentities.includes('session:generation:shared-1'), true)
  })

  it('conserva provenance del coach y produce solamente el write set aceptado', () => {
    const review = buildPlanningReviewDecisionBlocks(buildDiff())
    const planBlock = review.blocks.find(({ kind }) => kind === 'plan')
    const macroBlock = review.blocks.find(({ kind }) => kind === 'macrocycle')
    const competitionBlock = review.blocks.find(({ kind }) => kind === 'competition')
    assert.ok(planBlock)
    assert.ok(macroBlock)
    assert.ok(competitionBlock)

    const decisions = [{
      blockId: planBlock.id,
      decision: 'accept' as const,
      provenance: {
        source: 'coach' as const,
        coachId: 'coach-1',
        decidedAt: '2026-09-12T15:00:00.000-03:00',
        reason: 'Título confirmado',
      },
    }, {
      blockId: macroBlock.id,
      decision: 'accept' as const,
      provenance: {
        source: 'coach' as const,
        coachId: 'coach-1',
        decidedAt: '2026-09-12T15:01:00.000-03:00',
        reason: 'Carga revisada',
      },
    }, {
      blockId: competitionBlock.id,
      decision: 'reject' as const,
      provenance: {
        source: 'coach' as const,
        coachId: 'coach-1',
        decidedAt: '2026-09-12T15:02:00.000-03:00',
        reason: 'Mantener prioridad B',
      },
    }]

    const selection = validatePlanningReviewBlockSelection(review, decisions)

    assert.equal(selection.isValid, true)
    assert.deepEqual(selection.pendingBlockIds, [])
    assert.equal(
      selection.acceptedItemIdentities.includes('competition:id:competition-1'),
      false,
    )
    assert.deepEqual(selection.decisions, decisions)
  })

  it('no permite aceptar bloques con conflictos protegidos', () => {
    const diff = buildDiff()
    const conflictedItems = diff.items.map((item) => (
      item.identity === 'microcycle:id:micro-1'
        ? {
            ...item,
            classification: 'conflict' as const,
            operation: 'none' as const,
            reason: 'protected_change' as const,
          }
        : item
    ))
    const review = buildPlanningReviewDecisionBlocks({
      ...diff,
      items: conflictedItems,
      counts: { ...diff.counts, updated: 3, conflict: 1 },
      hasConflicts: true,
    })
    const planBlock = review.blocks.find(({ kind }) => kind === 'plan')
    const macroBlock = review.blocks.find(({ kind }) => kind === 'macrocycle')
    assert.ok(planBlock)
    assert.ok(macroBlock)

    const selection = validatePlanningReviewBlockSelection(review, [{
      blockId: planBlock.id,
      decision: 'accept',
      provenance: {
        source: 'coach',
        coachId: 'coach-1',
        decidedAt: '2026-09-12T15:00:00.000-03:00',
        reason: null,
      },
    }, {
      blockId: macroBlock.id,
      decision: 'accept',
      provenance: {
        source: 'coach',
        coachId: 'coach-1',
        decidedAt: '2026-09-12T15:01:00.000-03:00',
        reason: null,
      },
    }])

    assert.equal(macroBlock.canAccept, false)
    assert.equal(selection.isValid, false)
    assert.equal(
      selection.issues.some(({ code }) => code === 'conflicted_block_accepted'),
      true,
    )
  })
})
