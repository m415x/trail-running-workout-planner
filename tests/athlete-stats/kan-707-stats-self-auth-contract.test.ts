import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const action = readFileSync('app/actions/athlete-stats-actions.ts', 'utf8')
const adapter = readFileSync('lib/athlete-stats/athlete-stats-action.ts', 'utf8')
const service = readFileSync('lib/athlete-stats/athlete-stats-read-service.ts', 'utf8')

test('KAN-707 Stats production action uses dedicated H5B SELF authority, not planning.self.read', () => {
  assert.match(action, /createH5bSelfNextServerContext/)
  assert.match(action, /requireAuthenticatedEptAction/)
  assert.match(action, /stats\.self\.read/)
  assert.doesNotMatch(action, /\bgetCurrentAthlete\s*\(/)
})

test('KAN-707 Stats read service distinguishes DENY from valid loaded and technical error', () => {
  assert.match(service, /status: 'denied'/)
  assert.match(service, /status: 'loaded'/)
  assert.match(service, /status: 'error'/)
  assert.doesNotMatch(service, /current_athlete_unavailable/)
})

test('KAN-707 Stats adapter does not grant authority by resolving H5A current athlete', () => {
  assert.doesNotMatch(adapter, /\bgetCurrentAthlete\s*\(/)
  assert.match(adapter, /resolveCurrentAthlete/)
})
