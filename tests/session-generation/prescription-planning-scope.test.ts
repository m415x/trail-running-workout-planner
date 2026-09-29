import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  resolvePrescriptionPlanningScope,
} from '@/lib/session-generation/prescription-planning-scope'

describe('prescription planning scope', () => {
  it('derives distinct Base and Variant scopes for the same sporting group from microcycle lineage', () => {
    const base = resolvePrescriptionPlanningScope({
      prescription: { groupId: 'S2', microcycleId: 'micro-base' },
      lineage: {
        microcycleId: 'micro-base',
        groupTrainingPlanId: 'plan-base',
        groupId: 'S2',
        planningCohortId: null,
      },
    })
    const variant = resolvePrescriptionPlanningScope({
      prescription: { groupId: 'S2', microcycleId: 'micro-race' },
      lineage: {
        microcycleId: 'micro-race',
        groupTrainingPlanId: 'plan-race',
        groupId: 'S2',
        planningCohortId: 'cohort-race',
      },
    })

    assert.deepEqual(base, {
      microcycleId: 'micro-base',
      groupTrainingPlanId: 'plan-base',
      groupId: 'S2',
      planningCohortId: null,
      source: 'base',
    })
    assert.deepEqual(variant, {
      microcycleId: 'micro-race',
      groupTrainingPlanId: 'plan-race',
      groupId: 'S2',
      planningCohortId: 'cohort-race',
      source: 'variant',
    })
    assert.notEqual(base.microcycleId, variant.microcycleId)
  })

  it('keeps different sporting groups distinct without requiring a cohort', () => {
    const s2 = resolvePrescriptionPlanningScope({
      prescription: { groupId: 'S2', microcycleId: 'micro-s2' },
      lineage: {
        microcycleId: 'micro-s2',
        groupTrainingPlanId: 'plan-s2',
        groupId: 'S2',
        planningCohortId: null,
      },
    })
    const m1 = resolvePrescriptionPlanningScope({
      prescription: { groupId: 'M1', microcycleId: 'micro-m1' },
      lineage: {
        microcycleId: 'micro-m1',
        groupTrainingPlanId: 'plan-m1',
        groupId: 'M1',
        planningCohortId: null,
      },
    })

    assert.notEqual(s2.groupId, m1.groupId)
    assert.notEqual(s2.microcycleId, m1.microcycleId)
  })

  it('rejects a prescription whose microcycle does not match the supplied lineage', () => {
    assert.throws(
      () => resolvePrescriptionPlanningScope({
        prescription: { groupId: 'S2', microcycleId: 'micro-base' },
        lineage: {
          microcycleId: 'micro-other',
          groupTrainingPlanId: 'plan-base',
          groupId: 'S2',
          planningCohortId: null,
        },
      }),
      /microcycle/i,
    )
  })

  it('rejects a prescription whose sporting group does not match its planning lineage', () => {
    assert.throws(
      () => resolvePrescriptionPlanningScope({
        prescription: { groupId: 'S2', microcycleId: 'micro-base' },
        lineage: {
          microcycleId: 'micro-base',
          groupTrainingPlanId: 'plan-m1',
          groupId: 'M1',
          planningCohortId: null,
        },
      }),
      /group/i,
    )
  })
})
