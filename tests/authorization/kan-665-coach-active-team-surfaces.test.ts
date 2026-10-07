import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const athleteActions = readFileSync('app/actions/athlete-actions.ts', 'utf8')
const groupActions = readFileSync('app/actions/group-actions.ts', 'utf8')
const athletesPage = readFileSync('app/[locale]/dashboard/athletes/page.tsx', 'utf8')
const groupsPage = readFileSync('app/[locale]/dashboard/groups/page.tsx', 'utf8')

function section(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start)
  assert.notEqual(start, -1, `missing marker: ${startMarker}`)
  assert.notEqual(end, -1, `missing marker: ${endMarker}`)
  return source.slice(start, end)
}

describe('KAN-665 minimal active-Team integration for Coach H4A surfaces', () => {
  it('removes fixed Team authority from Athlete and Sporting Group server actions', () => {
    assert.doesNotMatch(athleteActions, /CURRENT_TEAM_ID/)
    assert.doesNotMatch(groupActions, /CURRENT_TEAM_ID/)
  })

  it('authorizes active sporting-group options used by Athlete administration', () => {
    const body = section(
      athleteActions,
      'export async function getActiveAthleteGroups',
      'export async function createAthlete',
    )

    assert.match(body, /requireAuthenticatedEptAction/)
    assert.match(body, /createActiveTeamNextServerContext/)
    assert.match(body, /createH4aNextServerAuthorizationBoundary/)
    assert.match(body, /capability:\s*['"]sporting_group\.admin\.manage['"]/)
    assert.match(body, /requiredScope:\s*['"]team['"]/)
    assert.match(body, /eq\(athleteGroups\.teamId,\s*authorizationResult\.teamId\)/)
  })

  it('keeps Coach list pages behind protected server actions rather than direct persistence access', () => {
    assert.match(athletesPage, /getAthletesByTeam\(\)/)
    assert.doesNotMatch(athletesPage, /from ['"]@\/db['"]|db\./)

    assert.match(groupsPage, /getGroupsByTeam\(\)/)
    assert.doesNotMatch(groupsPage, /from ['"]@\/db['"]|db\./)
  })
})
