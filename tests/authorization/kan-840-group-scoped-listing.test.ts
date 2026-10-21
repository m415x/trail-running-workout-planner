import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const action = readFileSync('app/actions/planning-actions.ts', 'utf8')
const source = action.slice(
  action.indexOf('export async function getCoachPlanningListResult()'),
  action.indexOf('export async function getGroupTrainingPlanById('),
)

describe('KAN-840/T1 group-scoped listing authorization RED', () => {
  it('must not demand TEAM scope where H4B already recognizes planning.manage scoped to Sporting Group', () => {
    assert.doesNotMatch(
      source,
      /requiredScope:\s*['"]team['"]/,
      'List authorization may not narrow legitimate planning.manage Sporting Group coverage to TEAM only',
    )
  })

  it('must check planning.manage against persisted eligible Sporting Groups before authorized EMPTY', () => {
    const listing = source.slice(source.indexOf('async authorizeListing('), source.indexOf('async loadPlans('))
    assert.match(listing, /planning\.manage/)
    assert.match(listing, /sportingGroupId|group\.id|groupId/,
      'List authorization must prove actual covered Sporting Group even when no Plan exists')
  })
})
