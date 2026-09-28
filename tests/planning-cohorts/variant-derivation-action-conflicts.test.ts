import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

function source(path: string) {
  return readFileSync(path, 'utf8')
}

describe('KAN-518 variant derivation action conflicts', () => {
  it('validates the reviewed source plan against the subgroup before persistence', () => {
    const actions = source('app/actions/planning-cohort-actions.ts')

    assert.match(actions, /getPlanningCohortVariantDerivationContext/)
    assert.match(actions, /sourcePlanId/)
    assert.match(actions, /basePlans/)
    assert.match(actions, /planningVariant/)
    assert.match(actions, /selectedCompetitionEntryIds/)
  })

  it('rejects selected competitions that do not belong to the reviewed base plan', () => {
    const actions = source('app/actions/planning-cohort-actions.ts')

    assert.match(actions, /competitionEntries/)
    assert.match(actions, /groupTrainingPlanId/)
    assert.match(actions, /selectedCompetitionEntryIds/)
    assert.match(actions, /every|some/)
  })

  it('keeps persistence delegated to the canonical transactional authority', () => {
    const actions = source('app/actions/planning-cohort-actions.ts')

    assert.match(actions, /persistPlanningCohortVariantSynchronously/)
    assert.doesNotMatch(actions, /insert\(groupTrainingPlans\)/)
  })
})
