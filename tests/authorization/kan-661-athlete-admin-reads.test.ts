import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync('app/actions/athlete-actions.ts', 'utf8')

function sliceBetween(startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start)
  assert.notEqual(start, -1, `missing marker: ${startMarker}`)
  assert.notEqual(end, -1, `missing marker: ${endMarker}`)
  return source.slice(start, end)
}

describe('KAN-661 authorized administrative AthleteProfile reads', () => {
  it('authorizes athlete list through H2 + active-Team + H3 athlete.admin.manage', () => {
    const list = sliceBetween(
      'export async function getAthletesByTeam',
      'export async function getAthleteById',
    )

    assert.match(source, /requireAuthenticatedEptAction/)
    assert.match(source, /readEptSessionAccessState/)
    assert.match(source, /createH4aNextServerAuthorizationBoundary/)

    assert.match(list, /requireAuthenticatedEptAction/)
    assert.match(list, /authorization\.authorize/)
    assert.match(list, /capability:\s*['"]athlete\.admin\.manage['"]/)
    assert.match(list, /requiredScope:\s*['"]team['"]/)
    assert.match(list, /resource:\s*\{\s*teamId:/)

    assert.doesNotMatch(list, /CURRENT_TEAM_ID/)
    assert.doesNotMatch(list, /users\.role|\.role\s*===/)
  })

  it('uses the resolved active Team to scope the list query', () => {
    const list = sliceBetween(
      'export async function getAthletesByTeam',
      'export async function getAthleteById',
    )

    assert.match(list, /authorizationResult\.teamId/)
    assert.match(
      list,
      /eq\(athleteProfiles\.teamId,\s*authorizationResult\.teamId\)/,
    )
  })

  it('loads detail ownership first and denies a cross-Team AthleteProfile through H3', () => {
    const detail = sliceBetween(
      'export async function getAthleteById',
      'export async function getActiveAthleteGroups',
    )

    assert.match(detail, /athleteProfiles\.id/)
    assert.match(detail, /authorization\.authorize/)
    assert.match(detail, /capability:\s*['"]athlete\.admin\.manage['"]/)
    assert.match(detail, /resource:\s*\{\s*teamId:\s*athlete\.teamId/)
    assert.match(detail, /requiredScope:\s*['"]team['"]/)

    assert.doesNotMatch(detail, /CURRENT_TEAM_ID/)
    assert.doesNotMatch(detail, /users\.role|\.role\s*===/)
  })

  it('does not return administrative athlete data when H2 or H3 denies access', () => {
    const list = sliceBetween(
      'export async function getAthletesByTeam',
      'export async function getAthleteById',
    )
    const detail = sliceBetween(
      'export async function getAthleteById',
      'export async function getActiveAthleteGroups',
    )

    assert.match(list, /access\.status\s*!==\s*['"]authenticated['"]/)
    assert.match(list, /authorizationResult\.allowed/)
    assert.match(detail, /access\.status\s*!==\s*['"]authenticated['"]/)
    assert.match(detail, /authorizationResult\.allowed/)
  })
})
