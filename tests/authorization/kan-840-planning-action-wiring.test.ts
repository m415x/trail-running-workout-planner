import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const action = readFileSync('app/actions/planning-actions.ts', 'utf8')
const operation = readFileSync('lib/planning/coach-planning-list-operation.ts', 'utf8')
const reader = readFileSync('lib/planning/coach-planning-list-reader.ts', 'utf8')
const legacyStart = action.indexOf('export async function getGroupTrainingPlans(')
const newStart = action.indexOf('export async function getCoachPlanningListResult(')
const detailStart = action.indexOf('export async function getGroupTrainingPlanById(')
const legacyList = action.slice(legacyStart, newStart)
const newList = action.slice(newStart, detailStart)

describe('KAN-840/T1 production integration contract', () => {
  it('keeps the legacy array API and composes a distinct discriminated reader', () => {
    assert.ok(legacyStart >= 0 && newStart > legacyStart && detailStart > newStart)
    assert.match(legacyList, /export async function getGroupTrainingPlans\s*\(/)
    assert.match(newList, /createCoachPlanningListOperation\(/)
    assert.match(operation, /createCoachPlanningListReader/)
    assert.match(reader, /status: 'denied'/)
    assert.match(reader, /status: 'empty'/)
    assert.match(reader, /status: 'ready'/)
    assert.match(reader, /status: 'error'/)
  })

  it('composes production H2 H3 H4A and the persisted H4B Plan authorization', () => {
    assert.match(newList, /requireAuthenticatedEptAction/)
    assert.match(newList, /createActiveTeamNextServerContext/)
    assert.match(newList, /createH4aNextServerAuthorizationBoundary/)
    assert.match(newList, /createPlanningReadAuthorization/)
    assert.match(operation, /planning\.manage/)
    assert.match(operation, /sportingGroupId/)
  })

  it('does not delegate through the lossy legacy array API', () => {
    assert.doesNotMatch(newList, /await getGroupTrainingPlans\s*\(/)
    assert.match(newList, /await operation\.read\(\)/)
    assert.match(newList, /result\.status/)
  })
})
