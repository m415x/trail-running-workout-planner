import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync('app/actions/session-actions.ts', 'utf8')
function action(name: string): string {
  const start = source.indexOf(`export async function ${name}(`)
  assert.notEqual(start, -1, `Missing ${name}`)
  const next = source.indexOf('export async function ', start + 1)
  return source.slice(start, next < 0 ? undefined : next)
}

describe('KAN-674 shared session reads authorization RED', () => {
  it('provides an authenticated H2, active-Team H4A, planning.manage session read boundary', () => {
    assert.match(source, /requireAuthenticatedEptAction/)
    assert.match(source, /createActiveTeamNextServerContext/)
    assert.match(source, /planning\.manage/)
    assert.match(source, /createH4aNextServerAuthorizationBoundary|createH4bPlanningAuthorizationBoundary/)
  })

  for (const name of [
    'getSessionsByTeam',
    'getSessionById',
    'getSessionGenerationExplanationReview',
  ]) {
    it(`${name} authorizes all current persisted prescription Sporting Groups before projecting data`, () => {
      const body = action(name)
      assert.doesNotMatch(body, /CURRENT_TEAM_ID/)
      assert.match(body, /authorizeSessionRead|planningReadAccess|sessionReadAuthorization/)
      assert.match(body, /sessionId|session\.id|sessions/)
    })
  }

  it('the list may not trust a caller-supplied Team as authorization authority', () => {
    const list = action('getSessionsByTeam')
    assert.doesNotMatch(list, /teamId:\s*string\s*=\s*CURRENT_TEAM_ID/)
    assert.match(list, /planningReadAccess|authorizeSessionRead|sessionReadAuthorization/)
  })

  it('reads form options only for authenticated and group-scoped planning access', () => {
    const options = action('getSessionFormOptions')
    assert.doesNotMatch(options, /CURRENT_TEAM_ID/)
    assert.match(options, /planningReadAccess|authorizeSessionRead|sessionReadAuthorization/)
  })
})
