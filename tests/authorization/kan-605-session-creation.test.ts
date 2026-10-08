import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync('app/actions/session-actions.ts', 'utf8')
const start = source.indexOf('export async function createSession(')
const end = source.indexOf('export async function updateSession(', start)
assert.ok(start >= 0 && end > start)
const creation = source.slice(start, end)

describe('KAN-675 H4B session/prescription creation RED', () => {
  it('derives H2 authenticated actor and active Team rather than CURRENT_TEAM_ID', () => {
    assert.doesNotMatch(creation, /CURRENT_TEAM_ID/)
    assert.match(creation, /planningReadAccess\(/)
    assert.match(creation, /planningAccess\.teamId/)
  })

  it('requires planning.manage for every requested Sporting Group before inserting anything', () => {
    assert.match(creation, /prescriptions\.data/)
    assert.match(creation, /authorizeGroup\(/)
    assert.match(creation, /every\(|some\(|Promise\.all\(/)
    const authorization = creation.indexOf('authorizeGroup(')
    const transaction = creation.indexOf('db.transaction(')
    assert.ok(authorization !== -1 && transaction > authorization)
  })

  it('preserves existing prescription references, workout validations and atomic persistence', () => {
    assert.match(creation, /validatePrescriptionReferences\(/)
    assert.match(creation, /workoutNotFound/)
    assert.match(creation, /locationNotFound/)
    assert.match(creation, /tx\.insert\(sessions\)/)
    assert.match(creation, /tx\.insert\(groupSessionPrescriptions\)/)
  })
})
