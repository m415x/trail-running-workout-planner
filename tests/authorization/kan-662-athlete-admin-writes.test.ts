import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync('app/actions/athlete-actions.ts', 'utf8')

function section(startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start)
  assert.notEqual(start, -1, `missing marker: ${startMarker}`)
  assert.notEqual(end, -1, `missing marker: ${endMarker}`)
  return source.slice(start, end)
}

describe('KAN-662 authorized AthleteProfile writes', () => {
  it('authorizes create against resolved active Team before AthleteProfile or billing mutation', () => {
    const body = section(
      'export async function createAthlete',
      'export async function updateAthlete',
    )

    assert.match(body, /requireAuthenticatedEptAction/)
    assert.match(body, /createActiveTeamNextServerContext/)
    assert.match(body, /createH4aNextServerAuthorizationBoundary/)
    assert.match(body, /capability:\s*['"]athlete\.admin\.manage['"]/)
    assert.match(body, /requiredScope:\s*['"]team['"]/)
    assert.match(body, /resource:\s*\{\s*teamId:\s*activeTeam\.teamId/)
    assert.match(body, /teamId:\s*authorizationResult\.teamId/)
    assert.match(body, /createAthleteAdministration\(db,/)
    assert.match(body, /initializeNewAthleteBillingInTransaction/)
    assert.ok(
      body.indexOf('authorization.authorize') < body.indexOf('createAthleteAdministration'),
      'authorization must happen before create mutation',
    )
    assert.doesNotMatch(body, /CURRENT_TEAM_ID/)
    assert.doesNotMatch(body, /formData\.get\(['"]teamId['"]\)/)
  })

  it('derives update ownership from the stored AthleteProfile and denies cross-Team before mutation', () => {
    const body = section(
      'export async function updateAthlete',
      'export async function setAthleteActiveState',
    )

    assert.match(body, /athleteProfiles\.id/)
    assert.match(body, /resource:\s*\{\s*teamId:\s*athlete\.teamId/)
    assert.match(body, /capability:\s*['"]athlete\.admin\.manage['"]/)
    assert.match(body, /requiredScope:\s*['"]team['"]/)
    assert.match(body, /updateAthleteAdministration\(db,/)
    assert.match(body, /teamId:\s*authorizationResult\.teamId/)
    assert.ok(
      body.indexOf('authorization.authorize') < body.indexOf('updateAthleteAdministration'),
      'authorization must happen before update mutation',
    )
    assert.doesNotMatch(body, /CURRENT_TEAM_ID/)
    assert.doesNotMatch(body, /formData\.get\(['"]teamId['"]\)/)
  })

  it('derives lifecycle ownership from the stored AthleteProfile and denies cross-Team before state change', () => {
    const body = section(
      'export async function setAthleteActiveState',
      'export const assignAthleteToGroup',
    )

    assert.match(body, /athleteProfiles\.id/)
    assert.match(body, /resource:\s*\{\s*teamId:\s*athlete\.teamId/)
    assert.match(body, /capability:\s*['"]athlete\.admin\.manage['"]/)
    assert.match(body, /requiredScope:\s*['"]team['"]/)
    assert.match(body, /setAthleteProfileActiveState\(db,/)
    assert.match(body, /teamId:\s*authorizationResult\.teamId/)
    assert.ok(
      body.indexOf('authorization.authorize') < body.indexOf('setAthleteProfileActiveState'),
      'authorization must happen before lifecycle mutation',
    )
    assert.doesNotMatch(body, /CURRENT_TEAM_ID/)
  })
})
