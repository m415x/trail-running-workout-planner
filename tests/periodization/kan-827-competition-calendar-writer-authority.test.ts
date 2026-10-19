import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const actions = readFileSync(
  path.join(process.cwd(), 'app/actions/competition-calendar-actions.ts'),
  'utf8',
)

test('KAN-827 T1: competition writers must not use a fixed Team as authorization', () => {
  assert.doesNotMatch(actions, /const CURRENT_TEAM_ID\s*=\s*['"]team_1['"]/)
  assert.doesNotMatch(actions, /plan\.group\.teamId\s*!==\s*CURRENT_TEAM_ID/)
})

test('KAN-827 T1: writer authorization must request existing competition.manage TEAM capability', () => {
  assert.match(actions, /competition\.manage/)
  assert.match(actions, /requireAuthorizedCompetitionCalendarWriter/)
})
