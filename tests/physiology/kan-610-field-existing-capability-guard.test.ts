import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-732 coach 1000m mutations retain server-side team capability gate', () => {
  const actions = readFileSync('app/actions/field-performance-test-actions.ts', 'utf8')
  const athletes = readFileSync('app/actions/athlete-actions.ts', 'utf8')
  assert.match(actions, /resolveOwnedAthlete:\s*async \(athleteId: string\) => \{\s*const athlete = await getAthleteById\(athleteId\)/)
  const start = athletes.indexOf('export async function getAthleteById(')
  const end = athletes.indexOf('export async function getActiveAthleteGroups(', start)
  assert.ok(start >= 0 && end > start)
  const boundary = athletes.slice(start, end)
  assert.match(boundary, /createH4aNextServerAuthorizationBoundary\(\)/)
  assert.match(boundary, /capability:\s*'athlete.admin.manage'/)
  assert.match(boundary, /resource:\s*\{ teamId: athlete.teamId \}/)
  assert.match(boundary, /requiredScope:\s*'team'/)
  assert.match(boundary, /if \(!authorizationResult.allowed\)\s*\{\s*return undefined/)
})
