import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const athleteActions = readFileSync('app/actions/athlete-actions.ts', 'utf8')
const groupActions = readFileSync('app/actions/group-actions.ts', 'utf8')
const groupAssignment = readFileSync('lib/athletes/group-assignment-action.ts', 'utf8')

test('KAN-666 administrative mutations do not return raw internal error messages to the client', () => {
  for (const [name, source] of [
    ['athlete actions', athleteActions],
    ['group actions', groupActions],
    ['group assignment action', groupAssignment],
  ] as const) {
    assert.doesNotMatch(
      source,
      /error\s+instanceof\s+Error\s*\?\s*error\.message/,
      `${name} must log internal failures server-side and return a stable public error`,
    )
  }

  assert.match(athleteActions, /console\.error\(['"]Error creating athlete:/)
  assert.match(athleteActions, /console\.error\(['"]Error updating athlete:/)
  assert.match(groupActions, /console\.error\(['"]Error creating group:/)
  assert.match(groupActions, /console\.error\(['"]Error updating group:/)
})
