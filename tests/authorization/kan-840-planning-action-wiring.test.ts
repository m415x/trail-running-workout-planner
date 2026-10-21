import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync('app/actions/planning-actions.ts', 'utf8')
const existingList = source.slice(
  source.indexOf('export async function getGroupTrainingPlans('),
  source.indexOf('export async function getGroupTrainingPlanById('),
)

describe('KAN-840/T1 production integration RED', () => {
  it('exports a discriminated Coach planning list reader independently of legacy array API', () => {
    assert.match(source, /export async function getCoachPlanningListResult\s*\(/)
    assert.match(source, /createCoachPlanningListReader/)
    assert.match(existingList, /export async function getGroupTrainingPlans\s*\(/)
  })

  it('enforces planning.manage on the Team before returning authorized empty', () => {
    const start = source.indexOf('export async function getCoachPlanningListResult(')
    assert.notEqual(start, -1)
    const implementation = source.slice(start)
    assert.match(implementation, /planning\.manage/)
    assert.match(implementation, /createH4aNextServerAuthorizationBoundary/)
    assert.match(implementation, /sportingGroupId|teamId/)
  })

  it('does not route the new discriminated reader through the legacy lossy [] result', () => {
    const start = source.indexOf('export async function getCoachPlanningListResult(')
    assert.notEqual(start, -1)
    const implementation = source.slice(start)
    assert.doesNotMatch(implementation, /await getGroupTrainingPlans\s*\(/)
    assert.match(implementation, /status|createCoachPlanningListReader/)
  })
})
