import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

function source(path: string) {
  return readFileSync(path, 'utf8')
}

describe('KAN-518 planning subgroup variant derivation surface', () => {
  it('links a planning subgroup without a variant to a dedicated derivation review', () => {
    const detail = source('app/[locale]/dashboard/cohorts/[cohortId]/page.tsx')

    assert.match(detail, /\/derive/)
    assert.match(detail, /deriveVariant/)
    assert.match(detail, /cohort\.status === 'active'/)
  })

  it('provides a derivation review route scoped to the planning subgroup', () => {
    const page = source('app/[locale]/dashboard/cohorts/[cohortId]/derive/page.tsx')

    assert.match(page, /getPlanningCohortVariantDerivationContext/)
    assert.match(page, /PlanningCohortVariantDerivationForm/)
    assert.match(page, /cohortId/)
    assert.match(page, /basePlans/)
  })

  it('loads only direct base plans from the same sporting group and current team', () => {
    const actions = source('app/actions/planning-cohort-actions.ts')

    assert.match(actions, /getPlanningCohortVariantDerivationContext/)
    assert.match(actions, /planningCohortId/)
    assert.match(actions, /sourceGroupTrainingPlanId/)
    assert.match(actions, /cohort\.groupId/)
    assert.match(actions, /CURRENT_TEAM_ID/)
    assert.match(actions, /competitionEntries/)
  })

  it('keeps variant creation on the canonical KAN-517 persistence authority', () => {
    const actions = source('app/actions/planning-cohort-actions.ts')

    assert.match(actions, /persistPlanningCohortVariantSynchronously/)
    assert.match(actions, /selectedCompetitionEntryIds/)
    assert.match(actions, /redirect/)
  })
})
