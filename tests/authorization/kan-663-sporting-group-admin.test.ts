import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync('app/actions/group-actions.ts', 'utf8')

function section(startMarker: string, endMarker?: string): string {
  const start = source.indexOf(startMarker)
  const end = endMarker ? source.indexOf(endMarker, start) : source.length
  assert.notEqual(start, -1, `missing marker: ${startMarker}`)
  if (endMarker) assert.notEqual(end, -1, `missing marker: ${endMarker}`)
  return source.slice(start, end)
}

describe('KAN-663 authorized Sporting Group administration', () => {
  it('authorizes group list through active Team + H3 sporting_group.admin.manage', () => {
    const body = section('export async function getGroupsByTeam', 'export async function getGroupById')

    assert.match(source, /requireAuthenticatedEptAction/)
    assert.match(source, /createActiveTeamNextServerContext/)
    assert.match(source, /createH4aNextServerAuthorizationBoundary/)
    assert.match(body, /capability:\s*['"]sporting_group\.admin\.manage['"]/)
    assert.match(body, /requiredScope:\s*['"]team['"]/)
    assert.match(body, /eq\(athleteGroups\.teamId,\s*authorizationResult\.teamId\)/)
    assert.doesNotMatch(body, /CURRENT_TEAM_ID/)
  })

  it('authorizes group detail against stored group ownership and denies cross-Team access', () => {
    const body = section('export async function getGroupById', 'export async function getEligibleAthletesForGroup')

    assert.match(body, /athleteGroups\.id/)
    assert.match(body, /resource:\s*\{\s*teamId:\s*group\.teamId/)
    assert.match(body, /capability:\s*['"]sporting_group\.admin\.manage['"]/)
    assert.match(body, /requiredScope:\s*['"]team['"]/)
    assert.doesNotMatch(body, /CURRENT_TEAM_ID/)
  })

  it('delegates create persistence to a team-scoped group administration boundary after authorization', () => {
    const body = section('export async function createGroup', 'export async function updateGroup')

    assert.match(body, /authorization\.authorize/)
    assert.match(body, /capability:\s*['"]sporting_group\.admin\.manage['"]/)
    assert.match(body, /createSportingGroupAdministration\(db,/)
    assert.match(body, /teamId:\s*authorizationResult\.teamId/)
    assert.doesNotMatch(body, /db\.insert\(athleteGroups\)/)
    assert.doesNotMatch(body, /CURRENT_TEAM_ID/)
    assert.doesNotMatch(body, /formData\.get\(['"]teamId['"]\)/)
  })

  it('delegates update/lifecycle persistence to a team-scoped boundary using stored ownership', () => {
    const body = section('export async function updateGroup')

    assert.match(body, /athleteGroups\.id/)
    assert.match(body, /resource:\s*\{\s*teamId:\s*group\.teamId/)
    assert.match(body, /capability:\s*['"]sporting_group\.admin\.manage['"]/)
    assert.match(body, /updateSportingGroupAdministration\(db,/)
    assert.match(body, /teamId:\s*authorizationResult\.teamId/)
    assert.doesNotMatch(body, /db\.update\(athleteGroups\)/)
    assert.doesNotMatch(body, /CURRENT_TEAM_ID/)
  })
})

describe('KAN-663 team-scoped Sporting Group write boundaries', () => {
  it('keeps canonical create/update persistence outside group-actions', () => {
    const create = readFileSync('lib/groups/create-sporting-group-administration.ts', 'utf8')
    const update = readFileSync('lib/groups/update-sporting-group-administration.ts', 'utf8')

    assert.match(create, /teamId/)
    assert.match(create, /db|database/)
    assert.match(create, /athleteGroups/)
    assert.match(update, /teamId/)
    assert.match(update, /groupId/)
    assert.match(update, /athleteGroups/)
  })
})
