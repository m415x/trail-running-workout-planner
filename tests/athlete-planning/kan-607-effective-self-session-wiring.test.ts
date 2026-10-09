import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('lib/athlete-planning/effective-self-session-next-server.ts', 'utf8')
const start = source.indexOf('export function createH5aEffectiveSessionNextServerBoundary(')
const helper = source.indexOf('export function loadEffectiveSessionLocatorFromDatabase<')
assert.ok(start >= 0 && helper > start)
const composition = source.slice(start, helper)

test('KAN-700 Next server enforces persisted locator validation before querying planning evidence', () => {
  const guard = composition.indexOf('loadEffectiveSessionLocatorFromDatabase({')
  const history = composition.indexOf('const groupChanges =')
  assert.ok(guard >= 0, 'persisted locator guard must be invoked, not merely exported')
  assert.ok(history > guard, 'deny mismatched persisted ownership before reading planning history')
  assert.match(composition.slice(guard, history), /status !== 'resolved'|status === 'denied'/)
})

test('KAN-700 Next server passes authenticated SELF identity and persisted rows into locator guard', () => {
  assert.match(composition, /loadEffectiveSessionLocatorFromDatabase\(\{[\s\S]*?self:[\s\S]*?athlete[\s\S]*?session[\s\S]*?prescriptions:/)
  assert.match(composition, /self\.athleteProfileId/)
  assert.match(composition, /self\.userId/)
  assert.match(composition, /self\.teamId/)
})
