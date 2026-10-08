import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync('app/actions/session-generation-actions.ts', 'utf8')
const begin = source.indexOf('export async function persistGeneratedSessions(')
const end = source.indexOf('function serializeAuditValue(', begin)
assert.ok(begin >= 0 && end > begin)
const action = source.slice(begin, end)

describe('KAN-678 scoped generation and reconciliation RED', () => {
  it('requires H2 authentication, active Team and planning.manage on the persisted source plan', () => {
    assert.doesNotMatch(action, /CURRENT_TEAM_ID/)
    assert.match(action, /requireAuthenticatedEptAction|authorizePlanningGeneration/)
    assert.match(action, /planning\.manage|authorizePlanningGeneration/)
    assert.match(action, /plan\.groupId/)
  })
  it('checks all existing and resulting groups of shared events before mutation', () => {
    assert.match(action, /persistedPrescriptions/)
    assert.match(action, /persistedEvents/)
    assert.match(action, /authorizeGroup|authorizePlanningGeneration/)
    const guard = action.indexOf('authorizePlanningGeneration')
    const transaction = action.indexOf('db.transaction(')
    assert.ok(guard >= 0 && transaction > guard)
  })
  it('preserves proposal ownership checks, manual protections and reconciliation semantics', () => {
    assert.match(action, /validateProposalScope/)
    assert.match(action, /reconcileSessionGeneration/)
    assert.match(action, /reconciliation\.preservedRecords/)
    assert.match(action, /resolveGenerationExplanationSnapshot/)
  })
})
