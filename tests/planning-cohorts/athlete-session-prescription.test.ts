import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { resolveAthleteSessionPrescription } from '@/lib/planning-cohorts/athlete-session-prescription'

describe('athlete session prescription resolution', () => {
  it('selects the Variant prescription when dated planning resolves to the cohort plan', () => {
    const result = resolveAthleteSessionPrescription({
      planning: {
        status: 'resolved',
        source: 'cohort',
        groupId: 'S2',
        planId: 'plan-variant',
        cohortId: 'cohort-1',
      },
      prescriptions: [
        {
          id: 'prescription-base',
          groupId: 'S2',
          microcycleId: 'micro-base',
          groupTrainingPlanId: 'plan-base',
        },
        {
          id: 'prescription-variant',
          groupId: 'S2',
          microcycleId: 'micro-variant',
          groupTrainingPlanId: 'plan-variant',
        },
      ],
    })

    assert.deepEqual(result, {
      status: 'resolved',
      prescriptionId: 'prescription-variant',
      planId: 'plan-variant',
      microcycleId: 'micro-variant',
    })
  })

  it('does not fall back to Base when Variant is the applicable planning authority but has no prescription', () => {
    const result = resolveAthleteSessionPrescription({
      planning: {
        status: 'resolved',
        source: 'cohort',
        groupId: 'S2',
        planId: 'plan-variant',
        cohortId: 'cohort-1',
      },
      prescriptions: [
        {
          id: 'prescription-base',
          groupId: 'S2',
          microcycleId: 'micro-base',
          groupTrainingPlanId: 'plan-base',
        },
      ],
    })

    assert.deepEqual(result, {
      status: 'none',
      reason: 'no-prescription-for-applicable-plan',
      planId: 'plan-variant',
    })
  })
})
