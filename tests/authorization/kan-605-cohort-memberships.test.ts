import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync('app/actions/planning-cohort-actions.ts', 'utf8')

function action(name: string): string {
  const start = source.indexOf(`export async function ${name}(`)
  assert.notEqual(start, -1, `Missing ${name}`)
  const next = source.indexOf('export async function ', start + 1)
  return source.slice(start, next === -1 ? undefined : next)
}

describe('KAN-672 H4B dated Planning Cohort membership RED', () => {
  for (const name of [
    'assignAthleteToPlanningCohort',
    'closePlanningCohortMembership',
  ]) {
    it(`${name} derives active Team and verifies persisted cohort scope before transaction`, () => {
      const body = action(name)
      assert.doesNotMatch(body, /CURRENT_TEAM_ID/)
      assert.match(body, /requirePlanningContext\(/)
      assert.match(body, /authorizeGroup\(/)
      const scopeGuard = body.indexOf('authorizeGroup(')
      const mutation = body.indexOf('db.transaction(')
      assert.ok(scopeGuard !== -1 && mutation > scopeGuard, 'DENY must precede transaction')
    })
  }

  it('assignment validates AthleteProfile ownership from persistence and records the H2 actor', () => {
    const body = action('assignAthleteToPlanningCohort')
    assert.match(body, /athleteProfiles\.teamId/)
    assert.match(body, /cohort\.groupId/)
    assert.match(body, /validatePlanningCohortMembership\(/)
    assert.doesNotMatch(body, /assignedByUserId:\s*null/)
    assert.match(body, /assignedByUserId:\s*planningContext\.access\.userId/)
  })

  it('closure validates persisted membership identity and preserves append-only history', () => {
    const body = action('closePlanningCohortMembership')
    assert.match(body, /planningCohortMemberships\.planningCohortId/)
    assert.match(body, /validatePlanningCohortMembershipClosure\(/)
    assert.doesNotMatch(body, /endedByUserId:\s*null/)
    assert.match(body, /endedByUserId:\s*planningContext\.access\.userId/)
    assert.doesNotMatch(body, /tx\.delete\(/)
  })
})
