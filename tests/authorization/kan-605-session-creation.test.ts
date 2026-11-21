import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { executeAuthorizedSessionMutation } from '../../lib/sessions/authorized-session-mutation'

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

  it('delegates all resulting Sporting Groups to the shared H4A guard before mutation', () => {
    assert.match(creation, /prescriptions\.data/)
    assert.match(creation, /executeAuthorizedSessionMutation\(\{/)
    assert.match(creation, /existingGroupIds:\s*\[\s*\]/)
    assert.match(creation, /resultingGroupIds:\s*requestedGroups/)
    assert.match(creation, /authorizeGroup:\s*planningAccess\.authorizeGroup/)
    assert.match(creation, /mutate:\s*\(\)\s*=>\s*db\.transaction/)
    assert.match(creation, /if \(!authorized\) return \{ errorCode: 'groupNotFound' \}/)
    assert.ok(creation.indexOf('executeAuthorizedSessionMutation(') < creation.indexOf('tx.insert(sessions)'))
    assert.ok(creation.indexOf('tx.insert(sessions)') < creation.indexOf('tx.insert(groupSessionPrescriptions)'))
  })

  it('refuses a partially unauthorized Group set without invoking persistence', async () => {
    const checked: string[] = []
    let writes = 0
    const denied = await executeAuthorizedSessionMutation({
      existingGroupIds: [],
      resultingGroupIds: ['group-a', 'group-b'],
      authorizeGroup: async groupId => {
        checked.push(groupId)
        return groupId === 'group-a'
      },
      mutate: () => { writes++ },
    })
    assert.equal(denied, false)
    assert.deepEqual(checked.sort(), ['group-a', 'group-b'])
    assert.equal(writes, 0, 'DENY must never call transaction callback')

    const allowed = await executeAuthorizedSessionMutation({
      existingGroupIds: [],
      resultingGroupIds: ['group-a', 'group-b'],
      authorizeGroup: async () => true,
      mutate: () => { writes++ },
    })
    assert.equal(allowed, true)
    assert.equal(writes, 1)
  })

  it('preserves existing prescription references, workout validations and atomic persistence', () => {
    assert.match(creation, /validatePrescriptionReferences\(/)
    assert.match(creation, /workoutNotFound/)
    assert.match(creation, /locationNotFound/)
    assert.match(creation, /tx\.insert\(sessions\)/)
    assert.match(creation, /tx\.insert\(groupSessionPrescriptions\)/)
  })
})
