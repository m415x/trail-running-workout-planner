import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const action = readFileSync('app/actions/planning-actions.ts', 'utf8')
const operation = readFileSync('lib/planning/coach-planning-list-operation.ts', 'utf8')
const start = action.indexOf('export async function getCoachPlanningListResult()')
const end = action.indexOf('export async function getGroupTrainingPlanById(', start)
const composition = action.slice(start, end)

describe('KAN-840/T1 persisted scope authorization composition', () => {
  it('does not mandate TEAM-only scope for listing', () => {
    assert.ok(start >= 0 && end > start)
    assert.doesNotMatch(operation, /requiredScope:\s*['"]team['"]/)
    assert.match(composition, /createCoachPlanningListOperation/)
  })

  it('checks planning.manage against Team and persisted Sporting Groups before reading Plans', () => {
    const listingStart = operation.indexOf('async authorizeListing(')
    const listingEnd = operation.indexOf('loadPlans:', listingStart)
    assert.ok(listingStart >= 0 && listingEnd > listingStart)
    const listing = operation.slice(listingStart, listingEnd)
    assert.match(listing, /planning\.manage/)
    assert.match(listing, /deps\.listGroups\(context\.teamId\)/)
    assert.match(listing, /sportingGroupId: group\.id/)
    assert.match(listing, /authorizedGroups/)
    assert.ok(operation.indexOf('loadPlans:') > listingEnd - 1)
    assert.match(operation, /deps\.listPlans\(authorizedGroups\)/)
    assert.match(composition, /eq\(athleteGroups\.teamId, teamId\)/)
    assert.match(composition, /createPlanningReadAuthorization/)
  })
})
