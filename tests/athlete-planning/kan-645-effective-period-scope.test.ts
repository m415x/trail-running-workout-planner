import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { decideAthletePeriodPrescription } from '@/lib/athlete-planning/period-prescription-decision'
import type { AthletePlanningResolution } from '@/lib/planning-cohorts/planning-resolution'

const s2Plan: AthletePlanningResolution = {
  status: 'resolved',
  source: 'group',
  groupId: 'team_1_S2',
  planId: 'group_plan_s2_12k',
  cohortId: null,
}

describe('KAN-645/T8 — effective period prescription scope', () => {
  it('does not turn an unrelated Team session with zero prescriptions into a global conflict', () => {
    // Observed in local SQLite: session_s2_seed_fixture on 2026-10-12
    // has no prescriptions. Its absence is not evidence of an ambiguous
    // *applicable* prescription for an athlete with a resolved S2 plan.
    const result = decideAthletePeriodPrescription(s2Plan, {
      status: 'none',
      reason: 'no-prescription-for-applicable-plan',
      planId: s2Plan.planId,
    })
    assert.deepEqual(result, { kind: 'omit' })
  })

  it('keeps valid S2 prescriptions selectable, including a shared H4B Session', () => {
    const result = decideAthletePeriodPrescription(s2Plan, {
      status: 'resolved',
      prescriptionId: 'accept_h4b_shared_prescription_s2',
      planId: s2Plan.planId,
      microcycleId: 's2_12k_micro_1',
    })
    assert.deepEqual(result, { kind: 'continue' })
  })

  it('preserves a genuine ambiguity among prescriptions for the effective plan', () => {
    const result = decideAthletePeriodPrescription(s2Plan, {
      status: 'conflict',
      reason: 'multiple-prescriptions-for-applicable-plan',
      planId: s2Plan.planId,
      conflictingIds: ['prescription-a', 'prescription-b'],
    })
    assert.deepEqual(result, {
      kind: 'conflict',
      reason: 'multiple-prescriptions-for-applicable-plan',
    })
  })

  it('preserves genuine conflicting historical planning membership', () => {
    const result = decideAthletePeriodPrescription({
      status: 'conflict',
      reason: 'overlapping-cohorts',
      groupId: 'team_1_S2',
      conflictingIds: ['cohort-a', 'cohort-b'],
    }, { status: 'none', reason: 'planning-unresolved', planId: null })
    assert.deepEqual(result, { kind: 'conflict', reason: 'overlapping-cohorts' })
  })
})
