import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const membership = readFileSync('app/actions/membership-actions.ts', 'utf8')
const dashboard = readFileSync('app/actions/dashboard-actions.ts', 'utf8')

function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`)
  assert.ok(start >= 0, `missing ${name}`)

  const next = source.indexOf('\nexport async function ', start + 1)
  return next === -1 ? source.slice(start) : source.slice(start, next)
}

test('KAN-641 Coach economic mutation applies H2 action guard before handler execution', () => {
  const body = functionBody(membership, 'configureTeamEconomicPolicyAction')

  assert.match(membership, /requireAuthenticatedEptAction/)
  assert.match(membership, /readEptSessionAccessState/)
  assert.match(membership, /createSupabaseServerClient/)
  assert.match(membership, /createExternalIdentityLookup/)

  const guardIndex = body.indexOf('requireAuthenticatedEptAction')
  const handlerIndex = body.indexOf('handlers.configureTeamEconomicPolicy')

  assert.ok(guardIndex >= 0)
  assert.ok(handlerIndex > guardIndex)
  assert.match(body, /status\s*!==\s*['"]authenticated['"]/)
  assert.match(body, /success:\s*false/)
  assert.match(body, /error:\s*['\"]Acceso no autorizado['\"]/)
})

test('KAN-641 Athlete current-profile read applies H2 action guard before database access', () => {
  const body = functionBody(dashboard, 'getCurrentAthlete')

  assert.match(dashboard, /requireAuthenticatedEptAction/)
  assert.match(dashboard, /readEptSessionAccessState/)
  assert.match(dashboard, /createSupabaseServerClient/)
  assert.match(dashboard, /createExternalIdentityLookup/)

  const guardIndex = body.indexOf('requireAuthenticatedEptAction')
  const dbIndex = body.indexOf('db.query.users.findFirst')

  assert.ok(guardIndex >= 0)
  assert.ok(dbIndex > guardIndex)
  assert.match(body, /status\s*!==\s*['"]authenticated['"]/)
  assert.match(body, /success:\s*false/)
})

test('KAN-641 H2 remains mandatory while H5A SELF explicitly narrows Athlete reads', () => {
  const economicMutation = functionBody(membership, 'configureTeamEconomicPolicyAction')
  assert.match(economicMutation, /requireAuthenticatedEptAction/)
  assert.doesNotMatch(economicMutation, /createH5aSelfNextServerContext|planning\.self\.read|workout_log\.self\.manage/)

  const athleteRead = functionBody(dashboard, 'getCurrentAthlete')
  assert.match(athleteRead, /requireAuthenticatedEptAction/)
  assert.match(athleteRead, /createH5aSelfNextServerContext/)
  assert.match(athleteRead, /planning\.self\.read/)
  assert.ok(athleteRead.indexOf('requireAuthenticatedEptAction') < athleteRead.indexOf('createH5aSelfNextServerContext'))
})
