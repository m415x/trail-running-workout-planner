import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

function source(path: string) {
  return readFileSync(path, 'utf8')
}

function actionBody() {
  const actions = source('app/actions/planning-cohort-actions.ts')
  const start = actions.indexOf('export async function derivePlanningCohortVariantAction')
  const end = actions.indexOf('/** Creates an empty cohort', start)

  assert.notEqual(start, -1)
  assert.notEqual(end, -1)

  return actions.slice(start, end)
}

describe('KAN-518 variant derivation action conflicts', () => {
  it('revalidates the reviewed subgroup and source plan before persistence', () => {
    const action = actionBody()

    assert.match(action, /getPlanningCohortVariantDerivationContext/)
    assert.match(action, /basePlans/)
    assert.match(action, /planningVariant/)
    assert.match(action, /sourcePlanId/)
  })

  it('rejects selected competitions that do not belong to the reviewed base plan', () => {
    const action = actionBody()

    assert.match(action, /reviewedBasePlan\.competitionEntries/)
    assert.match(action, /selectedCompetitionEntryIds\.every/)
    assert.match(action, /reviewedCompetitionIds\.has/)
  })

  it('keeps persistence delegated to the canonical transactional authority', () => {
    const action = actionBody()

    assert.match(action, /persistPlanningCohortVariantSynchronously/)
    assert.doesNotMatch(action, /insert\(groupTrainingPlans\)/)
  })
})
