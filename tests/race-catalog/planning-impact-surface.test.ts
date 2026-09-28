import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

function source(path: string) {
  return readFileSync(path, 'utf8')
}

describe('KAN-519 race course planning impact surface', () => {
  it('loads planning impact on the race course detail', () => {
    const page = source('app/[locale]/dashboard/competitions/[[...segments]]/page.tsx')

    assert.match(page, /loadRaceCoursePlanningImpactSynchronously/)
    assert.match(page, /planningImpact/)
    assert.match(page, /course\.id/)
  })

  it('renders one operational planning row per linked competition entry', () => {
    const page = source('app/[locale]/dashboard/competitions/[[...segments]]/page.tsx')

    assert.match(page, /planTitle/)
    assert.match(page, /groupCode/)
    assert.match(page, /planningCohortName/)
    assert.match(page, /competitionPriority/)
    assert.match(page, /competitionStatus/)
  })

  it('links directly to the owning plan and planning subgroup without creating planning actions', () => {
    const page = source('app/[locale]/dashboard/competitions/[[...segments]]/page.tsx')

    assert.match(page, /dashboard\/planning/)
    assert.match(page, /dashboard\/cohorts/)
    assert.doesNotMatch(page, /derivePlanningCohortVariantAction/)
    assert.doesNotMatch(page, /persistPlanningCohortVariantSynchronously/)
  })

  it('uses localized planning impact copy', () => {
    const es = source('messages/es/competitions/race-catalog.json')
    const en = source('messages/en/competitions/race-catalog.json')

    assert.match(es, /planningImpact/)
    assert.match(en, /planningImpact/)
    assert.match(es, /Grupos deportivos|Grupo deportivo/)
    assert.match(en, /Sporting groups|Sporting group/)
  })
})
