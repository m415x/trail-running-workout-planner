import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validatePlanningCohortPlanAssociation } from '@/lib/planning-cohorts/plan-association'
import type { GroupTrainingPlan, PlanningCohort } from '@/types'

type PlanAssociationFields = Pick<
  GroupTrainingPlan,
  'id' | 'groupId' | 'planningCohortId' | 'sourceGroupTrainingPlanId'
>

const basePlan: PlanAssociationFields = {
  id: 'plan-base',
  groupId: 'group-m1',
  planningCohortId: null,
  sourceGroupTrainingPlanId: null,
}

const cohort: Pick<PlanningCohort, 'id' | 'groupId' | 'status'> = {
  id: 'cohort-42k',
  groupId: 'group-m1',
  status: 'active',
}

function variant(overrides: Partial<PlanAssociationFields> = {}): PlanAssociationFields {
  return {
    id: 'plan-variant',
    groupId: 'group-m1',
    planningCohortId: cohort.id,
    sourceGroupTrainingPlanId: basePlan.id,
    ...overrides,
  }
}

describe('asociación de planes a cohortes', () => {
  it('reconoce un plan grupal base sin contexto adicional', () => {
    const result = validatePlanningCohortPlanAssociation({
      plan: basePlan,
      cohort: null,
      sourcePlan: null,
    })

    assert.deepEqual(result, { isValid: true, kind: 'group_base', errors: [] })
  })

  it('reconoce una variante vinculada directamente a su plan base', () => {
    const result = validatePlanningCohortPlanAssociation({
      plan: variant(),
      cohort,
      sourcePlan: basePlan,
    })

    assert.deepEqual(result, { isValid: true, kind: 'cohort_variant', errors: [] })
  })

  it('rechaza asociaciones parciales y autorreferencias', () => {
    const partial = validatePlanningCohortPlanAssociation({
      plan: variant({ sourceGroupTrainingPlanId: null }),
      cohort,
      sourcePlan: null,
    })
    const selfReferenced = validatePlanningCohortPlanAssociation({
      plan: variant({ sourceGroupTrainingPlanId: 'plan-variant' }),
      cohort,
      sourcePlan: variant(),
    })

    assert.equal(partial.errors[0]?.code, 'incomplete-variant-association')
    assert.ok(selfReferenced.errors.some((error) => error.code === 'self-referenced-source-plan'))
  })

  it('exige que cohorte, variante y origen pertenezcan al mismo grupo', () => {
    const result = validatePlanningCohortPlanAssociation({
      plan: variant(),
      cohort: { ...cohort, groupId: 'group-s2' },
      sourcePlan: { ...basePlan, groupId: 'group-s2' },
    })

    assert.deepEqual(result.errors.map((error) => error.code), [
      'cohort-group-mismatch',
      'source-plan-group-mismatch',
    ])
  })

  it('rechaza cohortes archivadas y referencias inexistentes', () => {
    const archived = validatePlanningCohortPlanAssociation({
      plan: variant(),
      cohort: { ...cohort, status: 'archived' },
      sourcePlan: basePlan,
    })
    const missing = validatePlanningCohortPlanAssociation({
      plan: variant(),
      cohort: null,
      sourcePlan: null,
    })

    assert.equal(archived.errors[0]?.code, 'cohort-archived')
    assert.deepEqual(missing.errors.map((error) => error.code), [
      'cohort-not-found',
      'source-plan-not-found',
    ])
  })

  it('impide usar otra variante como origen', () => {
    const result = validatePlanningCohortPlanAssociation({
      plan: variant(),
      cohort,
      sourcePlan: variant({ id: basePlan.id }),
    })

    assert.equal(result.isValid, false)
    assert.ok(result.errors.some((error) => error.code === 'variant-source-not-base'))
  })
})

