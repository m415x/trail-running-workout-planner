import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync('app/actions/planning-actions.ts', 'utf8')

function section(start: string, end: string) {
  const from = source.indexOf(`export async function ${start}(`)
  const until = source.indexOf(`export async function ${end}(`, from)
  assert.ok(from !== -1 && until > from, `Missing planning action boundary for ${start}`)
  return source.slice(from, until)
}

describe('KAN-668 Base/Variant planning reads authorization RED', () => {
  it('list derives Team from authenticated H2/active-Team and does not query CURRENT_TEAM_ID', () => {
    const list = section('getGroupTrainingPlans', 'getGroupTrainingPlanById')
    assert.doesNotMatch(list, /CURRENT_TEAM_ID/)
    assert.match(list, /requireAuthenticatedAction|requireAuthenticated/)
    assert.match(list, /createH4b|authorizePlanning|planningAuthorization/)
    assert.match(list, /teamId/)
  })

  it('list filters every returned Base/Variant through persisted plan ownership and planning.manage', () => {
    const list = section('getGroupTrainingPlans', 'getGroupTrainingPlanById')
    assert.match(list, /planning\.manage|authorize\(/)
    assert.match(list, /groupTrainingPlans/)
    assert.match(list, /groupId|sportingGroupId/)
    assert.match(list, /allowed/)
  })

  it('detail denies cross-Team or out-of-scope plan IDs before exposing auxiliary strategies', () => {
    const detail = section('getGroupTrainingPlanById', 'saveLoadProgression')
    assert.doesNotMatch(detail, /CURRENT_TEAM_ID/)
    assert.match(detail, /requireAuthenticatedAction|requireAuthenticated/)
    assert.match(detail, /createH4b|authorizePlanning|planningAuthorization/)
    assert.match(detail, /allowed/)
    const guard = detail.indexOf('allowed')
    const auxiliary = detail.indexOf('const loadStrategy')
    assert.ok(guard !== -1 && auxiliary > guard, 'scope denial must precede strategy access')
  })
})
