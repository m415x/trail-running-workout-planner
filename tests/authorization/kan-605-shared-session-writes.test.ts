import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync('app/actions/session-actions.ts', 'utf8')
const start = source.indexOf('export async function updateSession(')
const end = source.indexOf('function validatePrescriptionReferences(', start)
assert.ok(start >= 0 && end > start)
const action = source.slice(start, end)

describe('KAN-676 shared session update authorization RED', () => {
  it('uses server active Team rather than fixed team', () => {
    assert.match(action, /planningReadAccess/)
    assert.match(action, /planningAccess\.teamId/)
    assert.doesNotMatch(action, /CURRENT_TEAM_ID/)
  })
  it('covers both previous and resulting Sporting Groups before transaction', () => {
    assert.match(action, /priorGroupIds|previousGroupIds|existingGroupIds/)
    assert.match(action, /resultGroupIds|resultingGroupIds|requestedGroupIds/)
    assert.match(action, /authorizeGroup/)
    assert.ok(action.indexOf('authorizeGroup') < action.indexOf('db.transaction('))
  })
  it('preserves reconciliation and authentic actor provenance', () => {
    assert.match(action, /onConflictDoUpdate/)
    assert.match(action, /sessionGenerationModificationRecords/)
    assert.doesNotMatch(action, /changedByUserId:\s*null/)
    assert.match(action, /changedByUserId:\s*planningAccess\.userId/)
  })
})
