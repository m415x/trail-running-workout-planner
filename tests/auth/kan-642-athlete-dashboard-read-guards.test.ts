import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/actions/dashboard-actions.ts', 'utf8')

function functionBody(name: string): string {
  const start = source.indexOf(`export async function ${name}`)
  assert.ok(start >= 0, `missing ${name}`)
  const next = source.indexOf('\nexport async function ', start + 1)
  return next === -1 ? source.slice(start) : source.slice(start, next)
}

for (const name of [
  'getWeeklySchedule',
  'getCurrentAthletePlanningWeek',
  'getAthleteShoes',
]) {
  test(`KAN-642 ${name} enforces H2 before Athlete DB reads`, () => {
    const body = functionBody(name)
    const guardIndex = body.indexOf('requireAuthenticatedEptAction')
    const dbIndex = body.indexOf('db.')

    assert.ok(guardIndex >= 0, `${name} must invoke the H2 action guard`)
    assert.ok(dbIndex > guardIndex, `${name} must guard before DB access`)
    assert.match(body, /status\s*!==\s*['"]authenticated['"]/)
    assert.match(body, /success:\s*false/)
  })
}

test('KAN-642 dashboard preserves H2 authentication and adds SELF authorization to sporting reads', () => {
  assert.match(source, /requireAuthenticatedEptAction/)
  assert.match(source, /readEptSessionAccessState/)
  assert.match(source, /createSupabaseServerClient/)
  assert.match(source, /createExternalIdentityLookup/)

  for (const name of ['getCurrentAthlete', 'getCurrentAthletePlanningWeek']) {
    const body = functionBody(name)
    assert.match(body, /createH5aSelfNextServerContext/)
    assert.match(body, /planning\.self\.read/)
    assert.ok(body.indexOf('requireAuthenticatedEptAction') < body.indexOf('createH5aSelfNextServerContext'))
  }
})
