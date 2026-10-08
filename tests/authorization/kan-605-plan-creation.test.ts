import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync('app/actions/load-strategy-actions.ts', 'utf8')
const creation = source.slice(source.indexOf('export async function createGroupPlanWithLoadStrategy('))

describe('KAN-669 H4B plan creation authorization RED', () => {
  it('resolves the authenticated H2 actor and H4A active Team, never a fixed Team', () => {
    assert.doesNotMatch(creation, /CURRENT_TEAM_ID/)
    assert.match(creation, /requireAuthenticatedEptAction/)
    assert.match(creation, /createActiveTeamNextServerContext|createH4bPlanningAuthorizationBoundary/)
  })

  it('uses persisted Sporting Group ownership and H3 planning.manage before writing', () => {
    assert.match(creation, /eq\(athleteGroups\.id,\s*data\.groupId\)/)
    assert.match(creation, /planning\.manage|createH4bPlanningAuthorizationBoundary/)
    assert.match(creation, /authorization|allowed/)
    const guard = creation.search(/if\s*\(\s*!\w+\.allowed/)
    const mutation = creation.indexOf('db.transaction(')
    assert.ok(guard !== -1 && mutation > guard, 'DENY must precede every plan write')
  })

  it('preserves one atomic plan + strategy + preferences + macrocycle transaction', () => {
    const transaction = creation.slice(creation.indexOf('db.transaction('))
    for (const table of [
      'groupTrainingPlans',
      'loadStrategies',
      'intensityStrategies',
      'sessionGenerationPreferences',
      'macrocycles',
      'planningModificationRecords',
    ]) {
      assert.match(transaction, new RegExp(`tx\\.insert\\(${table}\\)`))
    }
  })

  it('records existing planning provenance from the authenticated H2 User', () => {
    assert.doesNotMatch(creation, /changedByUserId:\s*null/)
    assert.match(creation, /changedByUserId:\s*access\.userId|changedByUserId:\s*\w+\.userId/)
  })
})
