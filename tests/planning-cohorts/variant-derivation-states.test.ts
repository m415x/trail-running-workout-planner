import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

function source(path: string) {
  return readFileSync(path, 'utf8')
}

describe('KAN-518 variant derivation states and lineage', () => {
  it('renders explicit no-base-plan, no-variant, existing-variant and conflict states', () => {
    const detail = source('app/[locale]/dashboard/cohorts/[cohortId]/page.tsx')
    const derive = source('app/[locale]/dashboard/cohorts/[cohortId]/derive/page.tsx')
    const form = source('features/planning/components/PlanningCohortVariantDerivationForm.tsx')

    assert.match(detail, /noVariantDescription/)
    assert.match(detail, /planningVariant/)
    assert.match(detail, /sourceGroupTrainingPlan/)
    assert.match(derive, /noBasePlansDescription/)
    assert.match(form, /state\.error/)
    assert.match(form, /role='alert'/)
  })

  it('shows base plan and planning subgroup lineage on the existing variant detail', () => {
    const planning = source('app/[locale]/dashboard/planning/[planId]/page.tsx')

    assert.match(planning, /planningCohort/)
    assert.match(planning, /sourceGroupTrainingPlan/)
    assert.match(planning, /Base plan|Plan base/)
    assert.match(planning, /t\('planningSubgroup'\)/)
  })

  it('keeps variant detail navigation connected to its planning subgroup context', () => {
    const planning = source('app/[locale]/dashboard/planning/[planId]/page.tsx')

    assert.match(planning, /cohorts/)
    assert.match(planning, /planningCohortId/)
  })
})
