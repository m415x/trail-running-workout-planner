import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync('app/actions/planning-cohort-actions.ts', 'utf8')
const scopedReads = [
  'getActiveGroupsForPlanningCohort',
  'getAthletesForPlanningCohort',
  'getAthletePlanningResolutionOnDate',
  'getPlanningCohortsByTeam',
  'getPlanningCohortDetail',
  'getPlanningCohortVariantDerivationContext',
] as const

function action(name: string) {
  const start = source.indexOf(`export async function ${name}(`)
  assert.notEqual(start, -1, `Missing ${name}`)
  const next = source.indexOf('export async function ', start + 1)
  return source.slice(start, next < 0 ? undefined : next)
}

describe('KAN-671 H4B Planning Cohort administration RED', () => {
  it('requires H2 / active Team and planning.manage in a shared scoped cohort authorization boundary', () => {
    assert.match(source, /requireAuthenticatedEptAction/)
    assert.match(source, /createActiveTeamNextServerContext/)
    assert.match(source, /createH4aNextServerAuthorizationBoundary|createH4bPlanningAuthorizationBoundary/)
    assert.match(source, /planning\.manage/)
  })

  for (const name of scopedReads) {
    it(`${name} does not rely on fixed CURRENT_TEAM_ID and checks the scoped cohort boundary`, () => {
      const body = action(name)
      assert.doesNotMatch(body, /CURRENT_TEAM_ID/)
      assert.match(body, /authorize|Authenticated|planningAccess|planningContext/)
    })
  }

  for (const name of ['createPlanningCohort', 'updatePlanningCohort']) {
    it(`${name} checks persisted group/cohort ownership before any write`, () => {
      const body = action(name)
      assert.doesNotMatch(body, /CURRENT_TEAM_ID/)
      assert.match(body, /authorize|planningAccess|planningContext/)
      assert.match(body, /groupId|cohortId/)
      const guard = body.search(/!\w+\.allowed|!\w+|\.status\s*!==\s*'authenticated'/)
      const mutation = body.search(/db\.(?:insert|update|transaction)\(/)
      assert.ok(guard !== -1 && mutation > guard, 'authorization denial must precede persistence')
    })
  }

  it('does not change assignment, closure or Base-to-Variant derivation in T5', () => {
    for (const name of [
      'assignAthleteToPlanningCohort',
      'closePlanningCohortMembership',
      'derivePlanningCohortVariantAction',
    ]) assert.match(source, new RegExp(`export async function ${name}\\(`))
  })
})
